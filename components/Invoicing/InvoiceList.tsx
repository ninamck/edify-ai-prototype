'use client';

import { useState, useMemo, useEffect } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import Link from 'next/link';
import { MOCK_INVOICES, Invoice, InvoiceMatchStatus, needsReviewCount, autoMatchedCount, isSplitBillingInvoice, splitBillingCount, getPOsForInvoice, getInvoiceStatusBadgeVariant, getExternallySyncedIds } from './mockData';
import { getCreditNotesForInvoice } from '@/components/CreditNotes/mockData';
import { MOCK_PASS_THROUGH_INVOICES, PassThroughInvoice, PassThroughStatus, grandTotal, vatAmount } from '@/components/PassThrough/mockData';
import { recordSync } from './syncLog';

function isSyncableStatus(s: InvoiceMatchStatus): boolean {
  return s === 'Matched' || s === 'Approved';
}

function blockedReason(s: InvoiceMatchStatus): string | null {
  switch (s) {
    case 'Variance': return 'Unresolved variance — resolve before syncing.';
    case 'Parse Failed': return 'Parse failed — re-upload or fix fields before syncing.';
    case 'Duplicate': return 'Possible duplicate — confirm not-a-duplicate first.';
    case 'Matching in Progress': return 'Awaiting delivery — no GRN yet.';
    default: return null;
  }
}

type Tab = 'needs-review' | 'all' | 'approved' | 'split-billing' | 'pass-through';

interface InvoiceListProps {
  onViewInvoice: (id: string) => void;
  onViewPassThrough?: (id: string) => void;
}

export default function InvoiceList({ onViewInvoice, onViewPassThrough }: InvoiceListProps) {
  const [tab, setTab] = useState<Tab>('needs-review');
  const [search, setSearch] = useState('');
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locallySynced, setLocallySynced] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [pendingSync, setPendingSync] = useState<Invoice[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isSyncable = (inv: Invoice) => isSyncableStatus(inv.status);

  const clearSelection = () => setSelected(new Set());
  useEffect(() => { clearSelection(); }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-sync cleanly-matched invoices (no variances, nothing to review) and merge any
  // invoices synced via other flows (e.g. parse-failed recovery) into locallySynced so
  // the list shows them with the ✓ and "Synced to Xero" subtext on return.
  useEffect(() => {
    const toAuto = MOCK_INVOICES.filter(
      inv => inv.status === 'Matched' && inv.variances.length === 0
    );
    const externalIds = getExternallySyncedIds();
    if (toAuto.length === 0 && externalIds.length === 0) return;
    for (const inv of toAuto) inv.status = 'Approved';
    setLocallySynced(prev => {
      const next = new Set(prev);
      toAuto.forEach(inv => next.add(inv.id));
      externalIds.forEach(id => next.add(id));
      return next;
    });
    if (toAuto.length > 0) {
      const total = toAuto.reduce((s, i) => s + i.total, 0);
      recordSync(toAuto.map(i => i.id), toAuto.map(i => i.invoiceNumber), total);
      setToast(`${toAuto.length} auto-synced on arrival · £${total.toFixed(2)}`);
    }
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doSync = (invoices: Invoice[]) => {
    if (invoices.length === 0) return;
    const ids = invoices.map(i => i.id);
    setSyncing(new Set(ids));
    setTimeout(() => {
      // Single source of truth: mutate the invoice records so the detail view agrees
      for (const inv of invoices) {
        const row = MOCK_INVOICES.find(i => i.id === inv.id);
        if (row) row.status = 'Approved';
      }
      setLocallySynced(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
      setSyncing(new Set());
      setSelected(new Set());
      const total = invoices.reduce((s, i) => s + i.total, 0);
      recordSync(ids, invoices.map(i => i.invoiceNumber), total);
      setToast(`${ids.length} synced to Xero · £${total.toFixed(2)}`);
    }, 900);
  };

  const reviewCount = needsReviewCount();
  const matchedCount = autoMatchedCount();
  const splitCount = splitBillingCount();

  const filtered = useMemo(() => {
    let list = MOCK_INVOICES;
    if (tab === 'needs-review') list = list.filter(i => i.status === 'Variance' || i.status === 'Parse Failed' || i.status === 'Duplicate');
    else if (tab === 'approved') list = list.filter(i => i.status === 'Approved');
    else if (tab === 'split-billing') list = list.filter(isSplitBillingInvoice);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q));
    }
    return list;
  }, [tab, search]);

  const approvedCount = MOCK_INVOICES.filter(i => i.status === 'Approved').length;
  const passThroughCount = MOCK_PASS_THROUGH_INVOICES.length;

  // POs with 2+ non-excluded invoices — each gets a distinct accent color so siblings visually group
  const splitPOs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inv of MOCK_INVOICES) {
      if (inv.status === 'Duplicate' || inv.status === 'Parse Failed') continue;
      for (const po of getPOsForInvoice(inv)) counts.set(po, (counts.get(po) ?? 0) + 1);
    }
    return Array.from(counts.entries()).filter(([, c]) => c > 1).map(([po]) => po);
  }, []);

  const syncableFiltered = useMemo(
    () => filtered.filter(inv => isSyncable(inv) && !locallySynced.has(inv.id)),
    [filtered, locallySynced]
  );
  const blockedInFiltered = useMemo(
    () => filtered.filter(inv => !isSyncable(inv)),
    [filtered, locallySynced]
  );
  const selectedInvoices = useMemo(
    () => filtered.filter(inv => selected.has(inv.id) && !locallySynced.has(inv.id) && isSyncable(inv)),
    [filtered, selected, locallySynced]
  );
  const allSyncableSelected = syncableFiltered.length > 0 && syncableFiltered.every(i => selected.has(i.id));
  const someSyncableSelected = syncableFiltered.some(i => selected.has(i.id));
  const toggleAll = () => {
    setSelected(prev => {
      if (allSyncableSelected) {
        const next = new Set(prev);
        syncableFiltered.forEach(i => next.delete(i.id));
        return next;
      }
      const next = new Set(prev);
      syncableFiltered.forEach(i => next.add(i.id));
      return next;
    });
  };

  const readyApprovedInvoices = useMemo(
    () => MOCK_INVOICES.filter(inv => inv.status === 'Approved' && !locallySynced.has(inv.id)),
    [locallySynced]
  );
  const showSelectionUI = tab !== 'pass-through';
  const passThroughFiltered = useMemo(() => {
    if (!search) return MOCK_PASS_THROUGH_INVOICES;
    const q = search.toLowerCase();
    return MOCK_PASS_THROUGH_INVOICES.filter(p =>
      p.invoiceNumber.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
  }, [search]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: '100px',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    background: active ? 'var(--color-accent-active)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flex: isMobile ? 1 : undefined,
  });

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Invoices
        </h1>
        <Link
          href="/invoices/settings"
          style={{
            padding: '9px 14px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          ⚙ Rules
        </Link>
      </div>

      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{matchedCount}</span>
          {' '}auto-matched today
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-border-subtle)' }}>·</span>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{reviewCount}</span>
          {' '}need review
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: '100px', padding: '3px', marginBottom: '16px', width: isMobile ? '100%' : 'fit-content' }}>
        <button onClick={() => setTab('needs-review')} style={tabStyle(tab === 'needs-review')}>
          Review
          <TabBadge count={reviewCount} active={tab === 'needs-review'} />
        </button>
        {splitCount > 0 && (
          <button onClick={() => setTab('split-billing')} style={tabStyle(tab === 'split-billing')}>
            Split billing
            <TabBadge count={splitCount} active={tab === 'split-billing'} />
          </button>
        )}
        <button onClick={() => setTab('approved')} style={tabStyle(tab === 'approved')}>
          Approved
          <TabBadge count={approvedCount} active={tab === 'approved'} />
        </button>
        <button onClick={() => setTab('pass-through')} style={tabStyle(tab === 'pass-through')}>
          Pass-through
          <TabBadge count={passThroughCount} active={tab === 'pass-through'} />
        </button>
        <button onClick={() => setTab('all')} style={tabStyle(tab === 'all')}>
          All
          <TabBadge count={MOCK_INVOICES.length} active={tab === 'all'} />
        </button>
      </div>

      {/* Pass-through helper strip */}
      {tab === 'pass-through' && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--color-info-light)',
          border: '1px solid rgba(3, 105, 161, 0.18)',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.5,
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '15px', lineHeight: 1 }}>ℹ</span>
          <div>
            <strong style={{ color: 'var(--color-info)', fontWeight: 700 }}>Pass-through invoices</strong> — bills with no PO and no Edify supplier (rent, utilities, insurance, etc.). These skip matching and go straight to Xero. Set a category so Xero maps the right account.
          </div>
        </div>
      )}

      {/* Search + toolbar actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by invoice # or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            outline: 'none',
            background: '#fff',
            boxSizing: 'border-box',
            flex: '1 1 240px',
          }}
        />
        {showSelectionUI && readyApprovedInvoices.length > 0 && (
          <button
            onClick={() => setPendingSync(readyApprovedInvoices)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: 'var(--color-accent-active)',
              color: '#fff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Sync all approved ({readyApprovedInvoices.length})
          </button>
        )}
      </div>

      {/* Invoice table */}
      {tab === 'pass-through' ? (
        passThroughFiltered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            No pass-through invoices.
          </p>
        ) : (
          <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'var(--font-primary)',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr>
                  {['Invoice #', 'Supplier', 'Date', 'Due', 'Total', 'VAT', 'Category', 'Status', ''].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontSize: '12px', fontWeight: 500,
                        letterSpacing: '0.04em',
                        color: 'var(--color-text-secondary)',
                        borderBottom: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passThroughFiltered.map(p => (
                  <PassThroughRow
                    key={p.id}
                    invoice={p}
                    onView={() => onViewPassThrough?.(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          No invoices found.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff', marginBottom: selected.size > 0 ? '80px' : '0' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr>
                <th style={{
                  textAlign: 'center', padding: '10px 12px',
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  width: '40px',
                }}>
                  <HeaderCheckbox
                    allSelected={allSyncableSelected}
                    someSelected={someSyncableSelected && !allSyncableSelected}
                    disabled={syncableFiltered.length === 0}
                    onToggle={toggleAll}
                  />
                </th>
                {['Invoice #', 'Supplier', 'Date', 'Total', 'PO', 'GRN', 'Credit notes', 'Status', ''].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: '12px', fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: 'var(--color-text-secondary)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  isLocallySynced={locallySynced.has(inv.id)}
                  isSyncing={syncing.has(inv.id)}
                  syncable={isSyncable(inv)}
                  selected={selected.has(inv.id)}
                  splitPOs={splitPOs}
                  onToggle={() => toggleSelect(inv.id)}
                  onView={() => onViewInvoice(inv.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', top: '72px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-success-light)',
            border: '1px solid var(--color-success-border)',
            color: 'var(--color-success)',
            fontWeight: 700, fontSize: '13px',
            padding: '10px 18px',
            borderRadius: '8px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            zIndex: 900,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <span style={{ fontSize: '14px' }}>✓</span> {toast}
        </div>
      )}

      {selected.size > 0 && (
        <SyncActionBar
          count={selectedInvoices.length}
          blockedCount={blockedInFiltered.length}
          total={selectedInvoices.reduce((s, i) => s + i.total, 0)}
          onClear={clearSelection}
          onSync={() => setPendingSync(selectedInvoices)}
        />
      )}

      {pendingSync && pendingSync.length > 0 && (
        <SyncConfirmModal
          invoices={pendingSync}
          onCancel={() => setPendingSync(null)}
          onConfirm={() => {
            const list = pendingSync;
            setPendingSync(null);
            doSync(list);
          }}
        />
      )}
    </div>
  );
}

function HeaderCheckbox({ allSelected, someSelected, disabled, onToggle }: { allSelected: boolean; someSelected: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all syncable invoices"
      disabled={disabled}
      checked={allSelected}
      ref={el => { if (el) el.indeterminate = someSelected; }}
      onChange={onToggle}
      style={{
        width: '16px', height: '16px', cursor: disabled ? 'not-allowed' : 'pointer',
        accentColor: 'var(--color-accent-active)',
      }}
    />
  );
}

function SyncActionBar({ count, blockedCount, total, onClear, onSync }: { count: number; blockedCount: number; total: number; onClear: () => void; onSync: () => void }) {
  return (
    <div
      role="region"
      aria-label="Bulk sync selection"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: '#fff',
        borderTop: '1px solid var(--color-border-subtle)',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 800,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', maxWidth: '1100px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-accent-active)', color: '#fff', fontWeight: 700, fontSize: '12px' }}>
          {count}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {count === 1 ? '1 invoice selected' : `${count} invoices selected`} · £{total.toFixed(2)}
        </span>
        {blockedCount > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-warning)' }}>
            · {blockedCount} blocked in this view
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClear}
          style={{
            padding: '8px 14px', borderRadius: '8px',
            background: 'transparent', border: '1px solid var(--color-border)',
            fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)', cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          onClick={onSync}
          disabled={count === 0}
          style={{
            padding: '8px 18px', borderRadius: '8px',
            background: count === 0 ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
            color: count === 0 ? 'var(--color-text-secondary)' : '#fff',
            border: count === 0 ? '1px solid var(--color-border)' : 'none',
            fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-primary)',
            cursor: count === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Sync now →
        </button>
      </div>
    </div>
  );
}

function SyncConfirmModal({ invoices, onCancel, onConfirm }: { invoices: Invoice[]; onCancel: () => void; onConfirm: () => void }) {
  const total = invoices.reduce((s, i) => s + i.total, 0);
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 10px' }}>
          Sync {invoices.length} invoice{invoices.length === 1 ? '' : 's'} to Xero?
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Total <strong>£{total.toFixed(2)}</strong>. This pushes final invoice data and locks the rows.
        </p>
        <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', padding: '8px 12px', marginBottom: '18px', fontSize: '12px', lineHeight: 1.7 }}>
          {invoices.map(inv => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <span><strong>{inv.invoiceNumber}</strong> · {inv.supplier}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>£{inv.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--color-accent-active)', border: 'none', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}
          >
            Sync
          </button>
        </div>
      </div>
    </div>
  );
}

function PassThroughRow({ invoice, onView }: { invoice: PassThroughInvoice; onView: () => void }) {
  const statusVariant = (s: PassThroughStatus): 'warning' | 'error' | 'success' | 'info' | 'default' => {
    switch (s) {
      case 'Awaiting review': return 'warning';
      case 'Ready to send': return 'info';
      case 'Sent to Xero': return 'success';
      case 'Failed to sync': return 'error';
      default: return 'default';
    }
  };
  const cell: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' };
  return (
    <tr style={{ cursor: 'pointer' }} onClick={onView}>
      <td style={{ ...cell, fontWeight: 600, color: 'var(--color-accent-active)' }}>{invoice.invoiceNumber}</td>
      <td style={cell}>{invoice.supplier}</td>
      <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{invoice.invoiceDate}</td>
      <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{invoice.dueDate ?? '—'}</td>
      <td style={{ ...cell, fontWeight: 600 }}>£{grandTotal(invoice).toFixed(2)}</td>
      <td style={{ ...cell, color: invoice.vatRate === null ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
        {invoice.vatRate === null ? '—' : `${invoice.vatRate}% · £${vatAmount(invoice).toFixed(2)}`}
      </td>
      <td style={cell}>
        {invoice.category ? (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: '100px',
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-subtle)',
          }}>{invoice.category}</span>
        ) : (
          <span style={{ color: 'var(--color-warning)', fontSize: '11px', fontWeight: 700 }}>Set category</span>
        )}
      </td>
      <td style={cell}>
        <StatusBadge status={invoice.status} variant={statusVariant(invoice.status)} />
      </td>
      <td style={cell}>
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

const SPLIT_PO_PALETTE = [
  { bar: '#224444', chipBg: 'rgba(34,68,68,0.09)',  chipText: '#224444', chipBorder: 'rgba(34,68,68,0.25)' },
  { bar: '#0369A1', chipBg: 'rgba(3,105,161,0.09)', chipText: '#0369A1', chipBorder: 'rgba(3,105,161,0.25)' },
  { bar: '#EA580C', chipBg: 'rgba(234,88,12,0.09)', chipText: '#EA580C', chipBorder: 'rgba(234,88,12,0.25)' },
  { bar: '#6B21A8', chipBg: 'rgba(107,33,168,0.09)',chipText: '#6B21A8', chipBorder: 'rgba(107,33,168,0.25)' },
];

function colorForSplitPO(poNumber: string, splitPOs: string[]) {
  const idx = splitPOs.indexOf(poNumber);
  if (idx < 0) return null;
  return SPLIT_PO_PALETTE[idx % SPLIT_PO_PALETTE.length];
}

function InvoiceRow({ invoice, isLocallySynced, isSyncing, syncable, selected, splitPOs, onToggle, onView }: {
  invoice: Invoice;
  isLocallySynced: boolean;
  isSyncing: boolean;
  syncable: boolean;
  selected: boolean;
  splitPOs: string[];
  onToggle: () => void;
  onView: () => void;
}) {
  const isSplit = isSplitBillingInvoice(invoice);
  const checkboxDisabled = !syncable || isLocallySynced || isSyncing;
  const reason = blockedReason(invoice.status);
  const checkboxTitle = isLocallySynced
    ? 'Already synced to Xero.'
    : isSyncing
      ? 'Syncing…'
      : reason
        ? reason
        : 'Select for bulk sync';

  // Row accent color — first split-billed PO this invoice is on, if any
  const invoicePOs = getPOsForInvoice(invoice);
  const accent = invoicePOs.map(po => colorForSplitPO(po, splitPOs)).find(c => c !== null) ?? null;

  return (
    <tr style={{ cursor: 'pointer', background: selected ? 'rgba(34, 68, 68, 0.04)' : undefined }} onClick={onView}>
      <td
        style={{ padding: '12px 12px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'center', width: '40px', boxShadow: accent ? `inset 3px 0 0 ${accent.bar}` : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLocallySynced ? (
          <span title="Synced to Xero" style={{ color: 'var(--color-success)', fontSize: '14px', fontWeight: 700 }}>✓</span>
        ) : isSyncing ? (
          <Spinner />
        ) : (
          <input
            type="checkbox"
            aria-label={`Select ${invoice.invoiceNumber}`}
            title={checkboxTitle}
            disabled={checkboxDisabled}
            checked={selected}
            onChange={onToggle}
            style={{
              width: '16px', height: '16px',
              cursor: checkboxDisabled ? 'not-allowed' : 'pointer',
              accentColor: 'var(--color-accent-active)',
              opacity: checkboxDisabled ? 0.4 : 1,
            }}
          />
        )}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-accent-active)', whiteSpace: 'nowrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {invoice.invoiceNumber}
          {invoice.note && (
            <span
              title={invoice.note.length > 80 ? invoice.note.slice(0, 80) + '…' : invoice.note}
              aria-label="Has note"
              style={{ fontSize: '12px', cursor: 'help' }}
            >
              📝
            </span>
          )}
        </span>
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}>
        {invoice.supplier}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {invoice.date}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
        £{invoice.total.toFixed(2)}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <POList invoice={invoice} splitPOs={splitPOs} />
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: invoice.grnNumbers.length ? 'var(--color-accent-active)' : 'var(--color-text-secondary)', fontWeight: invoice.grnNumbers.length ? 600 : 400 }}>
        {invoice.grnNumbers.length > 0 ? invoice.grnNumbers.join(', ') : '—'}
        {invoice.suggestedGRN && (
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-info)', fontWeight: 600, marginTop: '2px' }}>
            + {invoice.suggestedGRN} suggested
          </span>
        )}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <CreditNoteChip invoice={invoice} />
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <StatusBadge status={invoice.status} variant={getInvoiceStatusBadgeVariant(invoice.status)} />
        {isLocallySynced && (
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
            Synced to Xero
          </span>
        )}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onView(); }}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

function POList({ invoice, splitPOs }: { invoice: Invoice; splitPOs: string[] }) {
  const pos = getPOsForInvoice(invoice);
  if (pos.length === 0) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {pos.map(po => {
        const accent = colorForSplitPO(po, splitPOs);
        if (accent) {
          return (
            <span
              key={po}
              title={`Multiple invoices share ${po}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '100px',
                background: accent.chipBg,
                color: accent.chipText,
                border: `1px solid ${accent.chipBorder}`,
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                width: 'fit-content',
                lineHeight: 1.35,
              }}
            >
              {po}
              <span style={{ fontSize: '9px', fontWeight: 700, opacity: 0.85, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                · split
              </span>
            </span>
          );
        }
        return (
          <span key={po} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-active)' }}>{po}</span>
        );
      })}
    </div>
  );
}

function CreditNoteChip({ invoice }: { invoice: Invoice }) {
  const showForStatus = invoice.status === 'Matched' || invoice.status === 'Approved';
  if (!showForStatus) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
  const notes = getCreditNotesForInvoice(invoice.invoiceNumber);
  if (notes.length === 0) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
  const label = notes.length === 1 ? notes[0].ref : `${notes.length} CNs`;
  const statuses = Array.from(new Set(notes.map(n => n.status)));
  const title = notes.map(n => `${n.ref} · ${n.status} · £${n.amount.toFixed(2)}`).join('\n');
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        background: 'rgba(3,105,161,0.08)',
        color: 'var(--color-info)',
        border: '1px solid rgba(3,105,161,0.22)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {label}
      <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.8 }}>· {statuses.join(', ')}</span>
    </span>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes invoice-sync-spin { to { transform: rotate(360deg); } }`}</style>
      <span
        aria-label="Syncing"
        style={{
          display: 'inline-block',
          width: '14px',
          height: '14px',
          border: '2px solid rgba(34, 68, 68, 0.2)',
          borderTopColor: 'var(--color-accent-active)',
          borderRadius: '50%',
          animation: 'invoice-sync-spin 0.8s linear infinite',
        }}
      />
    </>
  );
}

function TabBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
        color: active ? '#fff' : 'var(--color-text-secondary)',
      }}
    >
      {count}
    </span>
  );
}

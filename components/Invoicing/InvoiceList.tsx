'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import { MOCK_INVOICES, Invoice, needsReviewCount, autoMatchedCount } from './mockData';

type Tab = 'needs-review' | 'all' | 'approved';

interface InvoiceListProps {
  onViewInvoice: (id: string) => void;
}

export default function InvoiceList({ onViewInvoice }: InvoiceListProps) {
  const [tab, setTab] = useState<Tab>('needs-review');
  const [search, setSearch] = useState('');

  const reviewCount = needsReviewCount();
  const matchedCount = autoMatchedCount();

  const filtered = useMemo(() => {
    let list = MOCK_INVOICES;
    if (tab === 'needs-review') list = list.filter(i => i.status === 'Variance' || i.status === 'Parse Failed' || i.status === 'Duplicate');
    else if (tab === 'approved') list = list.filter(i => i.status === 'Approved');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q));
    }
    return list;
  }, [tab, search]);

  const approvedCount = MOCK_INVOICES.filter(i => i.status === 'Approved').length;

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
    gap: '6px',
  });

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        Invoices
      </h1>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard label="Auto-matched Today" count={matchedCount} variant="success" />
        <SummaryCard label="Needs Review" count={reviewCount} variant="warning" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: '100px', padding: '3px', marginBottom: '16px', width: 'fit-content' }}>
        <button onClick={() => setTab('needs-review')} style={tabStyle(tab === 'needs-review')}>
          Needs Review
          <TabBadge count={reviewCount} active={tab === 'needs-review'} />
        </button>
        <button onClick={() => setTab('all')} style={tabStyle(tab === 'all')}>
          All Invoices
          <TabBadge count={MOCK_INVOICES.length} active={tab === 'all'} />
        </button>
        <button onClick={() => setTab('approved')} style={tabStyle(tab === 'approved')}>
          Approved
          <TabBadge count={approvedCount} active={tab === 'approved'} />
        </button>
      </div>

      {/* Search */}
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
          marginBottom: '16px',
          boxSizing: 'border-box',
        }}
      />

      {/* Invoice table */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          No invoices found.
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
                {['Invoice #', 'Supplier', 'Date', 'Total', 'GRN', 'Status', ''].map(h => (
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
                <InvoiceRow key={inv.id} invoice={inv} onView={() => onViewInvoice(inv.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({ invoice, onView }: { invoice: Invoice; onView: () => void }) {
  const statusVariant = (): 'warning' | 'error' | 'success' | 'info' | 'default' => {
    switch (invoice.status) {
      case 'Variance': return 'warning';
      case 'Parse Failed': case 'Duplicate': return 'error';
      case 'Approved': case 'Matched': return 'success';
      case 'Matching in Progress': return 'info';
      default: return 'default';
    }
  };

  return (
    <tr style={{ cursor: 'pointer' }} onClick={onView}>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-accent-active)' }}>
        {invoice.invoiceNumber}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}>
        {invoice.supplier}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}>
        {invoice.date}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        ${invoice.total.toFixed(2)}
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
        <StatusBadge status={invoice.status} variant={statusVariant()} />
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

function SummaryCard({ label, count, variant }: { label: string; count: number; variant: 'success' | 'warning' }) {
  const bg = variant === 'success' ? 'var(--color-success-light)' : 'var(--color-warning-light)';
  const border = variant === 'success' ? 'var(--color-success-border)' : 'var(--color-warning-border)';
  const color = variant === 'success' ? 'var(--color-success)' : 'var(--color-warning)';
  return (
    <div
      style={{
        flex: '1 1 180px',
        minWidth: '160px',
        padding: '16px 20px',
        borderRadius: '10px',
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>{label}</div>
    </div>
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

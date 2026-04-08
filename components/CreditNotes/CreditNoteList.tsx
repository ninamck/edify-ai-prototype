'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  MOCK_CREDIT_NOTES,
  CreditNote,
  CreditNoteStatus,
  pendingChaseCount,
  overdueCount,
  totalOutstanding,
} from './mockData';
import type { BadgeVariant } from '@/components/Receiving/StatusBadge';

type Tab = 'pending' | 'all' | 'received';

interface CreditNoteListProps {
  onView: (id: string) => void;
}

function statusVariant(status: CreditNoteStatus): BadgeVariant {
  switch (status) {
    case 'Overdue':   return 'error';
    case 'Requested': return 'warning';
    case 'Chasing':   return 'warning';
    case 'Received':  return 'success';
    case 'Applied':   return 'default';
  }
}

export default function CreditNoteList({ onView }: CreditNoteListProps) {
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');

  const pendingCount  = pendingChaseCount();
  const overdue       = overdueCount();
  const outstanding   = totalOutstanding();
  const receivedCount = MOCK_CREDIT_NOTES.filter((cn) => cn.status === 'Received' || cn.status === 'Applied').length;

  const filtered = useMemo(() => {
    let list = MOCK_CREDIT_NOTES;
    if (tab === 'pending') {
      list = list.filter((cn) => cn.status === 'Requested' || cn.status === 'Chasing' || cn.status === 'Overdue');
    } else if (tab === 'received') {
      list = list.filter((cn) => cn.status === 'Received' || cn.status === 'Applied');
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (cn) =>
          cn.ref.toLowerCase().includes(q) ||
          cn.supplier.toLowerCase().includes(q) ||
          cn.reason.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, search]);

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
        Credit Notes
      </h1>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard label="Outstanding Balance" value={`£${outstanding.toFixed(2)}`} variant="warning" />
        <SummaryCard label="Overdue (21+ days)" value={String(overdue)} variant="error" />
        <SummaryCard label="Pending Chase" value={String(pendingCount)} variant="info" />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          background: 'var(--color-bg-hover)',
          borderRadius: '100px',
          padding: '3px',
          marginBottom: '16px',
          width: 'fit-content',
        }}
      >
        <button onClick={() => setTab('pending')} style={tabStyle(tab === 'pending')}>
          Pending Chase
          <TabBadge count={pendingCount} active={tab === 'pending'} />
        </button>
        <button onClick={() => setTab('all')} style={tabStyle(tab === 'all')}>
          All
          <TabBadge count={MOCK_CREDIT_NOTES.length} active={tab === 'all'} />
        </button>
        <button onClick={() => setTab('received')} style={tabStyle(tab === 'received')}>
          Received
          <TabBadge count={receivedCount} active={tab === 'received'} />
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by credit note #, supplier, or reason…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          maxWidth: '400px',
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

      {/* Table */}
      {filtered.length === 0 ? (
        <p
          style={{
            textAlign: 'center',
            padding: '32px',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          No credit notes found.
        </p>
      ) : (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#fff',
          }}
        >
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
                {['Credit Note #', 'Supplier', 'Raised', 'Days Outstanding', 'Amount', 'Reason', 'Status', ''].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontSize: '12px', fontWeight: 500,
                        letterSpacing: '0.04em',
                        color: 'var(--color-text-secondary)',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        background: 'var(--color-bg-hover)',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cn) => (
                <CreditNoteRow key={cn.id} creditNote={cn} onView={() => onView(cn.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreditNoteRow({ creditNote: cn, onView }: { creditNote: CreditNote; onView: () => void }) {
  const isOverdue = cn.status === 'Overdue';
  const daysColor = isOverdue
    ? '#B91C1C'
    : cn.daysOutstanding >= 14
    ? '#92400E'
    : 'var(--color-text-secondary)';

  return (
    <tr
      style={{ cursor: 'pointer' }}
      onClick={onView}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
      }}
    >
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontWeight: 700,
          color: 'var(--color-accent-active)',
        }}
      >
        {cn.ref}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-primary)',
          fontWeight: 500,
        }}
      >
        {cn.supplier}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {cn.raisedDate}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontWeight: 700,
          color: daysColor,
        }}
      >
        {cn.daysOutstanding}d
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
        }}
      >
        £{cn.amount.toFixed(2)}
      </td>
      <td
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {cn.reason}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <StatusBadge status={cn.status} variant={statusVariant(cn.status)} />
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
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

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'success' | 'warning' | 'error' | 'info';
}) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    warning: {
      bg: '#FEF3C7',
      border: '#FDE68A',
      color: '#92400E',
    },
    error: {
      bg: '#FEE2E2',
      border: '#FECACA',
      color: '#B91C1C',
    },
    info: {
      bg: '#DBEAFE',
      border: '#BFDBFE',
      color: '#1D4ED8',
    },
    success: {
      bg: '#DCFCE7',
      border: '#BBF7D0',
      color: '#15803D',
    },
  };
  const s = styles[variant];
  return (
    <div
      style={{
        flex: '1 1 180px',
        minWidth: '160px',
        padding: '16px 20px',
        borderRadius: '10px',
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{value}</div>
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginTop: '4px',
        }}
      >
        {label}
      </div>
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

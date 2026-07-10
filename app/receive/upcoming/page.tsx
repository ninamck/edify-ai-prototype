'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/Receiving/StatusBadge';
import CopyChip from '@/components/Receiving/CopyChip';
import DeliveriesTabs from '@/components/Receiving/DeliveriesTabs';
import { MOCK_POS, PO, poItemCount } from '@/components/Receiving/mockData';

/**
 * Upcoming deliveries — POs that have been sent and are awaiting (or part
 * way through) delivery. "Accept delivery" opens the receiving flow for
 * that order; once signed off it moves to the Accepted tab as a GRN.
 */

function poTotalValue(po: PO): number {
  return po.lines.reduce((s, l) => s + l.price * l.expectedQty, 0);
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
  background: 'var(--color-bg-hover)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--color-text-primary)',
  borderBottom: '1px solid var(--color-border-subtle)',
  whiteSpace: 'nowrap',
};

export default function UpcomingDeliveriesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');

  const sites = useMemo(() => Array.from(new Set(MOCK_POS.map(p => p.site))), []);

  const orders = useMemo(() => {
    let list = MOCK_POS.filter(p => p.status === 'Sent' || p.status === 'Partially Received');
    if (siteFilter !== 'all') list = list.filter(p => p.site === siteFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        p => p.poNumber.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q),
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.dateSent).getTime() - new Date(a.dateSent).getTime(),
    );
  }, [search, siteFilter]);

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
        Deliveries
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
        Orders on their way. Accept a delivery when it arrives to check it in and create its GRN.
      </p>

      <DeliveriesTabs active="upcoming" />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search PO # or supplier…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            maxWidth: '320px',
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            outline: 'none',
            background: '#fff',
          }}
        />
        <select
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            fontSize: '13px',
            fontFamily: 'var(--font-primary)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="all">All sites</option>
          {sites.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
        {orders.length} order{orders.length === 1 ? '' : 's'} awaiting delivery
        {siteFilter !== 'all' ? ` for ${siteFilter}` : ''}
      </p>

      {orders.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Nothing awaiting delivery.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>PO #</th>
                <th style={thStyle}>Sent</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Items</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {orders.map(po => (
                <tr
                  key={po.id}
                  onClick={() => router.push(`/receive/entry?pos=${po.id}`)}
                  style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {po.supplier}
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                      {po.site}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--color-accent-active)' }}>
                    {po.poNumber}
                    <CopyChip text={po.poNumber} />
                  </td>
                  <td style={tdStyle}>{po.dateSent}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{poItemCount(po)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    £{poTotalValue(po).toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={po.status} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        router.push(`/receive/entry?pos=${po.id}`);
                      }}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '8px',
                        background: 'var(--color-accent-active)',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Accept delivery
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

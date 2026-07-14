'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/Receiving/StatusBadge';
import CopyChip from '@/components/Receiving/CopyChip';
import {
  MOCK_COMPLETED_DELIVERIES,
  GRN,
  grnVarianceCount,
  deliverySequenceTag,
} from '@/components/Receiving/mockData';
import { BASE_CURRENCY, formatMoney } from '@/lib/currency';

/**
 * Accepted deliveries — the Deliveries area's record of everything that
 * has been received and signed off. Each entry is a GRN (goods received
 * note): the GRN number is the identity of an accepted delivery, so the
 * list is keyed and searchable by it. Rows open the GRN detail view
 * (/receive/grn/[id]).
 */

function grnTotal(grn: GRN): number {
  return grn.lines.reduce((s, l) => s + l.receivedQty * l.price, 0);
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

export default function AcceptedDeliveriesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');

  const sites = useMemo(
    () => Array.from(new Set(MOCK_COMPLETED_DELIVERIES.map(g => g.site))),
    [],
  );

  const deliveries = useMemo(() => {
    let list = MOCK_COMPLETED_DELIVERIES as GRN[];
    if (siteFilter !== 'all') list = list.filter(g => g.site === siteFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        g =>
          g.grnNumber.toLowerCase().includes(q) ||
          g.supplier.toLowerCase().includes(q) ||
          g.poNumbers.some(po => po.toLowerCase().includes(q)),
      );
    }
    // Most recent first
    return [...list].sort(
      (a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime(),
    );
  }, [search, siteFilter]);

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search GRN, supplier or PO…"
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
        {deliveries.length} deliver{deliveries.length === 1 ? 'y' : 'ies'}
        {siteFilter !== 'all' ? ` for ${siteFilter}` : ''}
      </p>

      {deliveries.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          No accepted deliveries match.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>GRN #</th>
                <th style={thStyle}>Invoice #</th>
                <th style={thStyle}>Received</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                <th style={thStyle}>Note</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(grn => {
                const variances = grnVarianceCount(grn);
                const deliveryTag = deliverySequenceTag(grn);
                return (
                  <tr
                    key={grn.id}
                    onClick={() => router.push(`/receive/grn/${grn.id}`)}
                    style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {grn.supplier}
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                        {grn.site}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--color-accent-active)' }}>
                      {grn.grnNumber}
                      <CopyChip text={grn.grnNumber} />
                    </td>
                    <td style={{ ...tdStyle, color: grn.invoiceNumber ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {grn.invoiceNumber ?? '—'}
                    </td>
                    <td style={tdStyle}>{grn.dateReceived}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {/* Foreign-currency deliveries show the billed amount with
                          the GBP value at the rate locked at receipt. */}
                      {grn.currency && grn.currency !== BASE_CURRENCY ? (
                        <>
                          {formatMoney(grnTotal(grn), grn.currency)}
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                            {formatMoney(grnTotal(grn) * (grn.lockedFxRate ?? 1), BASE_CURRENCY)}
                          </span>
                        </>
                      ) : (
                        <>£{grnTotal(grn).toFixed(2)}</>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {deliveryTag ?? '—'}
                        {variances > 0 && (
                          <StatusBadge status={`${variances} variance${variances > 1 ? 's' : ''}`} variant="warning" />
                        )}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={grn.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

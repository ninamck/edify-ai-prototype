'use client';

import { useState, useMemo } from 'react';
import StatusBadge from './StatusBadge';
import { MOCK_POS, MOCK_COMPLETED_DELIVERIES, poItemCount, poTotal, PO, GRN, grnVarianceCount } from './mockData';

interface POSelectionProps {
  onReceive: (poIds: string[]) => void;
  onBack: () => void;
}

export default function POSelection({ onReceive, onBack }: POSelectionProps) {
  const [tab, setTab] = useState<'awaiting' | 'completed'>('awaiting');
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sites = useMemo(() => {
    const all = MOCK_POS.map(p => p.site);
    return Array.from(new Set(all));
  }, []);

  const awaitingPOs = useMemo(() => {
    let list = MOCK_POS.filter(p => p.status === 'Sent' || p.status === 'Partially Received');
    if (siteFilter !== 'all') list = list.filter(p => p.site === siteFilter);
    if (search) list = list.filter(p => p.supplier.toLowerCase().includes(search.toLowerCase()) || p.poNumber.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [search, siteFilter]);

  const completedDeliveries = useMemo(() => {
    let list = MOCK_COMPLETED_DELIVERIES as GRN[];
    if (siteFilter !== 'all') list = list.filter(g => g.site === siteFilter);
    if (search) list = list.filter(g => g.supplier.toLowerCase().includes(search.toLowerCase()) || g.grnNumber.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [search, siteFilter]);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
  });

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)' }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Receive Delivery</h1>
      </div>

      {/* Tabs + actions row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: '100px', padding: '3px' }}>
          <button onClick={() => { setTab('awaiting'); setSelected(new Set()); }} style={tabStyle(tab === 'awaiting')}>
            Awaiting Delivery
          </button>
          <button onClick={() => { setTab('completed'); setSelected(new Set()); }} style={tabStyle(tab === 'completed')}>
            Completed
          </button>
        </div>

        {tab === 'awaiting' && selected.size > 0 && (
          <button
            onClick={() => onReceive(Array.from(selected))}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              background: 'var(--color-accent-active)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
            }}
          >
            Receive Selected ({selected.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search supplier or PO…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
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
          onChange={(e) => setSiteFilter(e.target.value)}
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
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Content */}
      {tab === 'awaiting' ? (
        <AwaitingList
          pos={awaitingPOs}
          selected={selected}
          onToggle={toggleSelected}
          onReceiveSingle={(id) => onReceive([id])}
        />
      ) : (
        <CompletedList deliveries={completedDeliveries} />
      )}
    </div>
  );
}

/* ──────────── Awaiting PO cards ──────────── */

function AwaitingList({ pos, selected, onToggle, onReceiveSingle }: { pos: PO[]; selected: Set<string>; onToggle: (id: string) => void; onReceiveSingle: (id: string) => void }) {
  if (pos.length === 0) {
    return <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>No purchase orders awaiting delivery.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {pos.map(po => (
        <div
          key={po.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px',
            borderRadius: '10px',
            border: selected.has(po.id) ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
            background: selected.has(po.id) ? 'rgba(34,68,68,0.03)' : '#fff',
            transition: 'all 0.15s',
          }}
        >
          {/* Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={selected.has(po.id)}
              onChange={() => onToggle(po.id)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent-active)', cursor: 'pointer' }}
            />
          </label>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{po.poNumber}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>— {po.supplier}</span>
              <StatusBadge status={po.status} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{po.site}</span>
              <span>·</span>
              <span>{poItemCount(po)} items</span>
              <span>·</span>
              <span>{poTotal(po)}</span>
              <span>·</span>
              <span>Sent {po.dateSent}</span>
            </div>
          </div>

          {/* Receive button */}
          <button
            onClick={() => onReceiveSingle(po.id)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Receive
          </button>
        </div>
      ))}
    </div>
  );
}

/* ──────────── Completed GRN cards ──────────── */

function CompletedList({ deliveries }: { deliveries: GRN[] }) {
  if (deliveries.length === 0) {
    return <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>No completed deliveries.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {deliveries.map(grn => {
        const variances = grnVarianceCount(grn);
        return (
          <div
            key={grn.id}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{grn.grnNumber}</span>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>— {grn.supplier}</span>
              <StatusBadge status={grn.status} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{grn.site}</span>
              <span>·</span>
              <span>Received {grn.dateReceived}</span>
              <span>·</span>
              <span>By {grn.receivedBy}</span>
              {variances > 0 && <StatusBadge status={`${variances} variance${variances > 1 ? 's' : ''}`} variant="warning" />}
              <StatusBadge status={grn.invoiceStatus} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

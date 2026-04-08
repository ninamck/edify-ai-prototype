'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';

type OrderStatus = 'Sent' | 'Confirmed' | 'Delivered' | 'Partial' | 'Cancelled';
type Tab = 'all' | 'pending' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  poNumber: string;
  supplier: string;
  dateOrdered: string;
  deliveryDate: string;
  items: number;
  total: number;
  status: OrderStatus;
}

const MOCK_ORDERS: Order[] = [
  { id: '1',  poNumber: 'PO-2026-041', supplier: 'Melbourne Coffee Traders',  dateOrdered: '7 Apr 2026',  deliveryDate: '9 Apr 2026',  items: 4,  total: 842.00,  status: 'Sent' },
  { id: '2',  poNumber: 'PO-2026-040', supplier: 'Anchor Dairy Co.',          dateOrdered: '6 Apr 2026',  deliveryDate: '8 Apr 2026',  items: 6,  total: 1230.50, status: 'Confirmed' },
  { id: '3',  poNumber: 'PO-2026-039', supplier: 'Baking Essentials Pty Ltd', dateOrdered: '5 Apr 2026',  deliveryDate: '7 Apr 2026',  items: 9,  total: 576.20,  status: 'Delivered' },
  { id: '4',  poNumber: 'PO-2026-038', supplier: 'Pure Produce Co.',          dateOrdered: '4 Apr 2026',  deliveryDate: '6 Apr 2026',  items: 12, total: 2104.80, status: 'Partial' },
  { id: '5',  poNumber: 'PO-2026-037', supplier: 'Melbourne Coffee Traders',  dateOrdered: '3 Apr 2026',  deliveryDate: '5 Apr 2026',  items: 3,  total: 390.00,  status: 'Delivered' },
  { id: '6',  poNumber: 'PO-2026-036', supplier: 'Suncoast Beverages',        dateOrdered: '2 Apr 2026',  deliveryDate: '4 Apr 2026',  items: 5,  total: 678.40,  status: 'Delivered' },
  { id: '7',  poNumber: 'PO-2026-035', supplier: 'Anchor Dairy Co.',          dateOrdered: '1 Apr 2026',  deliveryDate: '3 Apr 2026',  items: 7,  total: 1445.90, status: 'Delivered' },
  { id: '8',  poNumber: 'PO-2026-034', supplier: 'Pure Produce Co.',          dateOrdered: '31 Mar 2026', deliveryDate: '2 Apr 2026',  items: 8,  total: 920.00,  status: 'Cancelled' },
  { id: '9',  poNumber: 'PO-2026-033', supplier: 'Baking Essentials Pty Ltd', dateOrdered: '29 Mar 2026', deliveryDate: '31 Mar 2026', items: 11, total: 1388.60, status: 'Delivered' },
  { id: '10', poNumber: 'PO-2026-032', supplier: 'Suncoast Beverages',        dateOrdered: '27 Mar 2026', deliveryDate: '29 Mar 2026', items: 4,  total: 512.30,  status: 'Delivered' },
  { id: '11', poNumber: 'PO-2026-031', supplier: 'Melbourne Coffee Traders',  dateOrdered: '25 Mar 2026', deliveryDate: '27 Mar 2026', items: 2,  total: 210.00,  status: 'Cancelled' },
  { id: '12', poNumber: 'PO-2026-030', supplier: 'Anchor Dairy Co.',          dateOrdered: '24 Mar 2026', deliveryDate: '26 Mar 2026', items: 6,  total: 1190.75, status: 'Delivered' },
];

const STATUS_BADGE_VARIANT: Record<OrderStatus, 'info' | 'success' | 'warning' | 'error' | 'default'> = {
  Sent:      'info',
  Confirmed: 'info',
  Delivered: 'success',
  Partial:   'warning',
  Cancelled: 'error',
};

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Sent / Pending' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

function tabCount(orders: Order[], tab: Tab): number {
  if (tab === 'all') return orders.length;
  if (tab === 'pending') return orders.filter(o => o.status === 'Sent' || o.status === 'Confirmed').length;
  if (tab === 'delivered') return orders.filter(o => o.status === 'Delivered' || o.status === 'Partial').length;
  return orders.filter(o => o.status === 'Cancelled').length;
}

export default function OrderHistoryScreen() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  const ordersThisWeek = MOCK_ORDERS.filter(o =>
    ['7 Apr 2026', '6 Apr 2026', '5 Apr 2026', '4 Apr 2026', '3 Apr 2026', '2 Apr 2026', '1 Apr 2026'].includes(o.dateOrdered)
  ).length;
  const pendingDelivery = MOCK_ORDERS.filter(o => o.status === 'Sent' || o.status === 'Confirmed').length;
  const totalSpend = MOCK_ORDERS.reduce((sum, o) => sum + o.total, 0);

  const filtered = useMemo(() => {
    let list = MOCK_ORDERS;
    if (tab === 'pending')   list = list.filter(o => o.status === 'Sent' || o.status === 'Confirmed');
    if (tab === 'delivered') list = list.filter(o => o.status === 'Delivered' || o.status === 'Partial');
    if (tab === 'cancelled') list = list.filter(o => o.status === 'Cancelled');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => o.poNumber.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q));
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
        Order History
      </h1>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <SummaryCard label="Orders This Week" value={String(ordersThisWeek)} variant="success" />
        <SummaryCard label="Pending Delivery" value={String(pendingDelivery)} variant="warning" />
        <SummaryCard label="Total Spend (30d)" value={`$${totalSpend.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} variant="info" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: '100px', padding: '3px', marginBottom: '16px', width: 'fit-content', flexWrap: 'wrap', gap: '2px' }}>
        {TAB_LABELS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={tabStyle(tab === id)}>
            {label}
            <TabBadge count={tabCount(MOCK_ORDERS, id)} active={tab === id} />
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by PO number or supplier…"
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

      {/* Orders table */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          No orders found.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-primary)', fontSize: '13px' }}>
            <thead>
              <tr>
                {['PO #', 'Supplier', 'Date Ordered', 'Delivery Date', 'Items', 'Total', 'Status', ''].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontWeight: 500,
                      fontSize: '12px',
                      letterSpacing: '0.04em',
                      color: 'var(--color-text-secondary)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <tr style={{ cursor: 'pointer' }}>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-accent-active)', whiteSpace: 'nowrap' }}>
        {order.poNumber}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-primary)' }}>
        {order.supplier}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {order.dateOrdered}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {order.deliveryDate}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        {order.items}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
        ${order.total.toFixed(2)}
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <StatusBadge status={order.status} variant={STATUS_BADGE_VARIANT[order.status]} />
      </td>
      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <button
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
            whiteSpace: 'nowrap',
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant: 'success' | 'warning' | 'info' }) {
  const styles = {
    success: { bg: 'var(--color-success-light)', border: 'var(--color-success-border)', color: 'var(--color-success)' },
    warning: { bg: 'var(--color-warning-light)', border: 'var(--color-warning-border)', color: 'var(--color-warning)' },
    info:    { bg: '#DBEAFE', border: '#BFDBFE', color: '#1D4ED8' },
  }[variant];

  return (
    <div
      style={{
        flex: '1 1 180px',
        minWidth: '160px',
        padding: '16px 20px',
        borderRadius: '10px',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 700, color: styles.color }}>{value}</div>
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

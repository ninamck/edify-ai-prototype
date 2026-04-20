'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  useApprovals,
  resubmitApproval,
  getUser,
  RULE_LABELS,
  type PendingApproval,
} from '@/components/Approvals/approvalsStore';
import { useActingUser } from '@/components/DemoControls/demoStore';

type OrderStatus = 'Sent' | 'Confirmed' | 'Delivered' | 'Partial' | 'Cancelled' | 'Pending Review' | 'Declined' | 'Approved';
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
  approvalId?: string;
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
  Sent:             'info',
  Confirmed:        'info',
  Delivered:        'success',
  Partial:          'warning',
  Cancelled:        'error',
  'Pending Review': 'warning',
  Declined:         'error',
  Approved:         'success',
};

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

function isPending(status: OrderStatus): boolean {
  return status === 'Sent' || status === 'Confirmed' || status === 'Pending Review' || status === 'Approved';
}

function tabCount(orders: Order[], tab: Tab): number {
  if (tab === 'all') return orders.length;
  if (tab === 'pending') return orders.filter(o => isPending(o.status)).length;
  if (tab === 'delivered') return orders.filter(o => o.status === 'Delivered' || o.status === 'Partial').length;
  return orders.filter(o => o.status === 'Cancelled' || o.status === 'Declined').length;
}

function approvalToOrder(a: PendingApproval): Order {
  const status: OrderStatus =
    a.status === 'pending' ? 'Pending Review'
      : a.status === 'approved' ? 'Approved'
        : 'Declined';
  return {
    id: `ap-${a.id}`,
    poNumber: a.poNumber,
    supplier: a.supplier,
    dateOrdered: a.submittedAt.split(' · ')[0] ?? a.submittedAt,
    deliveryDate: '—',
    items: a.lines.length,
    total: a.total,
    status,
    approvalId: a.id,
  };
}

export default function OrderHistoryScreen() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const approvals = useApprovals();
  const actingUserId = useActingUser();
  const myApprovalOrders = useMemo(
    () => approvals
      .filter(a => a.submittedById === actingUserId)
      .map(approvalToOrder),
    [approvals, actingUserId],
  );

  const allOrders = useMemo(
    () => [...myApprovalOrders, ...MOCK_ORDERS],
    [myApprovalOrders],
  );

  const ordersThisWeek = allOrders.filter(o =>
    ['8 Apr 2026', '7 Apr 2026', '6 Apr 2026', '5 Apr 2026', '4 Apr 2026', '3 Apr 2026', '2 Apr 2026', '1 Apr 2026'].includes(o.dateOrdered)
  ).length;
  const pendingDelivery = allOrders.filter(o => isPending(o.status)).length;
  const totalSpend = allOrders.reduce((sum, o) => sum + o.total, 0);

  const filtered = useMemo(() => {
    let list = allOrders;
    if (tab === 'pending')   list = list.filter(o => isPending(o.status));
    if (tab === 'delivered') list = list.filter(o => o.status === 'Delivered' || o.status === 'Partial');
    if (tab === 'cancelled') list = list.filter(o => o.status === 'Cancelled' || o.status === 'Declined');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => o.poNumber.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q));
    }
    return list;
  }, [tab, search, allOrders]);

  const handleRowClick = (order: Order) => {
    if (!order.approvalId) return;
    const approval = approvals.find(a => a.id === order.approvalId);
    if (approval) setSelectedApproval(approval);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: isMobile ? '8px 6px' : '8px 18px',
    borderRadius: '100px',
    border: 'none',
    fontSize: isMobile ? '12px' : '13px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    background: active ? 'var(--color-accent-active)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    transition: 'all 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    flex: isMobile ? 1 : undefined,
    minWidth: 0,
  });

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        Order History
      </h1>

      {/* Summary line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{ordersThisWeek}</span>
          {' '}this week
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-border-subtle)' }}>·</span>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{pendingDelivery}</span>
          {' '}pending delivery
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-border-subtle)' }}>·</span>
        <span>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            ${totalSpend.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          {' '}spent (30d)
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--color-bg-hover)', borderRadius: '100px', padding: '3px', marginBottom: '16px', width: isMobile ? '100%' : 'fit-content' }}>
        {TAB_LABELS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={tabStyle(tab === id)}>
            {label}
            <TabBadge count={tabCount(allOrders, id)} active={tab === id} />
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
                <OrderRow key={order.id} order={order} onClick={() => handleRowClick(order)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedApproval && (
        <ApprovalStatusModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </div>
  );
}

function ApprovalStatusModal({ approval, onClose }: { approval: PendingApproval; onClose: () => void }) {
  const reviewer = approval.reviewedById ? getUser(approval.reviewedById) : null;
  const isDeclined = approval.status === 'declined';
  const isApproved = approval.status === 'approved';

  const headerColor =
    isDeclined ? 'var(--color-error)'
      : isApproved ? 'var(--color-success)'
        : 'var(--color-warning)';
  const headerBg =
    isDeclined ? 'var(--color-error-light)'
      : isApproved ? 'var(--color-success-light)'
        : 'var(--color-warning-light)';
  const headerLabel =
    isDeclined ? 'Declined by manager'
      : isApproved ? 'Approved by manager'
        : 'Waiting for manager review';

  const handleResubmit = () => {
    resubmitApproval(approval.id);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,20,25,0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, calc(100vw - 48px))',
          maxHeight: 'min(80vh, 720px)',
          background: '#fff',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(34,68,68,0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{
          padding: '14px 18px',
          background: headerBg,
          borderBottom: `1px solid ${headerColor}`,
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: headerColor, marginBottom: '2px' }}>
            {headerLabel}{approval.originalTotal !== undefined ? ' with edits' : ''}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {approval.poNumber} — {approval.supplier}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            {approval.originalTotal !== undefined ? (
              <>
                <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>${approval.originalTotal.toFixed(2)}</span>
                {' \u2192 '}
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>${approval.total.toFixed(2)}</span>
              </>
            ) : (
              <>${approval.total.toFixed(2)}</>
            )}
            {' · '}{approval.lines.length} items · submitted {approval.submittedAt}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isDeclined && approval.declineReason && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {reviewer?.name ?? 'Manager'} said
              </div>
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-error-light)',
                border: '1px solid var(--color-error-border)',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--color-text-primary)',
              }}>
                {approval.declineReason}
              </div>
            </div>
          )}

          {isApproved && approval.approvalNote && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {reviewer?.name ?? 'Manager'} said
              </div>
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--color-text-primary)',
              }}>
                {approval.approvalNote}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Why this was flagged
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {approval.triggeredRules.map((tr, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: '12px',
                  lineHeight: 1.4,
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
                    {RULE_LABELS[tr.rule]}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    {tr.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              Order lines{approval.originalLines ? ' (after manager edits)' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {approval.lines.map((l) => {
                const original = approval.originalLines?.find(o => o.sku === l.sku);
                const isNew = approval.originalLines && !original;
                const qtyChanged = original && original.qty !== l.qty;
                return (
                  <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <span style={{ color: qtyChanged ? 'var(--color-accent-active)' : 'var(--color-text-primary)', fontWeight: qtyChanged ? 700 : 400 }}>
                        {l.qty}
                      </span>
                      <span style={{ color: 'var(--color-text-primary)' }}>× {l.description}</span>
                      {qtyChanged && original && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>was {original.qty}</span>
                      )}
                      {isNew && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '100px', background: 'var(--color-accent-active)', color: '#fff', letterSpacing: '0.02em' }}>
                          ADDED
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      ${(l.qty * l.unitPrice).toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {approval.originalLines?.filter(o => !approval.lines.some(l => l.sku === o.sku)).map(removed => (
                <div key={removed.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', opacity: 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, textDecoration: 'line-through' }}>
                    <span>{removed.qty}</span>
                    <span>× {removed.description}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '100px', background: 'var(--color-error)', color: '#fff', letterSpacing: '0.02em', textDecoration: 'none' }}>
                      REMOVED
                    </span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                    ${(removed.qty * removed.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 18px',
          borderTop: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '8px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          {isDeclined && (
            <button
              onClick={handleResubmit}
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '8px',
                background: 'var(--color-accent-active)',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Edit & resubmit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const isApprovalRow = !!order.approvalId;
  return (
    <tr style={{ cursor: isApprovalRow ? 'pointer' : 'default' }} onClick={isApprovalRow ? onClick : undefined}>
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
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: isApprovalRow ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            border: isApprovalRow ? 'none' : '1px solid var(--color-border)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            color: isApprovalRow ? '#fff' : 'var(--color-text-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {order.status === 'Declined' ? 'See reason' : order.status === 'Pending Review' ? 'View status' : 'View'}
        </button>
      </td>
    </tr>
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

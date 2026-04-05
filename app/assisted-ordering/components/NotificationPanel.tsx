'use client';

import type { SuggestedOrder } from '../types';
import { getSupplier, isUrgent } from '../data/mockOrders';

interface Props {
  orders: SuggestedOrder[];
  grandTotal: number;
  totalItems: number;
  supplierTotals: Record<string, number>;
  supplierItemCounts: Record<string, number>;
  onReviewAll: () => void;
}

export default function NotificationPanel({
  orders,
  grandTotal,
  totalItems,
  supplierTotals,
  supplierItemCounts,
  onReviewAll,
}: Props) {
  // Sort: urgent first, then by send time
  const sorted = [...orders].sort((a, b) => {
    const supA = getSupplier(a.supplierId);
    const supB = getSupplier(b.supplierId);
    if (isUrgent(supA) && !isUrgent(supB)) return -1;
    if (!isUrgent(supA) && isUrgent(supB)) return 1;
    return supA.sendTime.localeCompare(supB.sendTime);
  });

  const supplierCount = orders.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '680px',
        margin: '0 auto',
        padding: '32px 24px',
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            margin: 0,
          }}
        >
          Assisted Ordering
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            margin: '6px 0 0',
          }}
        >
          {totalItems} items across {supplierCount} supplier{supplierCount !== 1 ? 's' : ''} — est. £{grandTotal.toFixed(0)}
        </p>
      </div>

      {/* Supplier cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sorted.map((order) => {
          const supplier = getSupplier(order.supplierId);
          const urgent = isUrgent(supplier);
          const total = supplierTotals[order.supplierId] ?? 0;
          const itemCount = supplierItemCounts[order.supplierId] ?? 0;

          return (
            <div
              key={order.id}
              style={{
                borderRadius: 'var(--radius-card)',
                border: urgent
                  ? '1.5px solid rgba(185,28,28,0.30)'
                  : '1px solid var(--color-border-subtle)',
                background: urgent ? 'rgba(185,28,28,0.02)' : 'var(--color-bg-surface)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {supplier.name}
                  </span>
                  {urgent && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-badge)',
                        background: 'rgba(185,28,28,0.12)',
                        color: '#B91C1C',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      Due {supplier.cutOffTime}
                    </span>
                  )}
                  {/* Order state badge */}
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-badge)',
                      background: 'var(--color-bg-hover)',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {order.state}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  £{total.toFixed(0)}
                </span>
              </div>

              {/* Card meta */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px', fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                  flexWrap: 'wrap',
                }}
              >
                <span>📦 Arriving {order.deliveryDate}</span>
                <span>·</span>
                <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                {urgent && (
                  <>
                    <span>·</span>
                    <span style={{ color: '#B91C1C', fontWeight: 600 }}>
                      Review soon — cut-off is {supplier.cutOffTime} today
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
        <button
          type="button"
          onClick={onReviewAll}
          style={{
            padding: '12px 32px',
            borderRadius: 'var(--radius-card)',
            border: 'none',
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            letterSpacing: '0.01em',
            boxShadow: '0 2px 8px rgba(34,68,68,0.18)',
            transition: 'background 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-deep)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-active)';
          }}
        >
          Review all orders →
        </button>
      </div>
    </div>
  );
}

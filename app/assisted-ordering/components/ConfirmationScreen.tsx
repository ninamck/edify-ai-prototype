'use client';

import type { SuggestedOrder } from '../types';
import { getSupplier } from '../data/mockOrders';

interface Props {
  orders: SuggestedOrder[];
  grandTotal: number;
  totalItems: number;
  supplierTotals: Record<string, number>;
  supplierItemCounts: Record<string, number>;
  removed: Set<string>;
  onDone: () => void;
}

export default function ConfirmationScreen({
  orders,
  grandTotal,
  totalItems,
  supplierTotals,
  supplierItemCounts,
  onDone,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(21,128,61,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(21,128,61,0.25)',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#15803D"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              margin: 0,
            }}
          >
            Orders confirmed
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              margin: 0,
            }}
          >
            {totalItems} items · £{grandTotal.toFixed(0)}
          </p>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
              margin: 0,
              marginTop: '4px',
            }}
          >
            Orders send automatically at each supplier&apos;s cut-off. You can edit until then.
          </p>
        </div>

        {/* Per-supplier summary */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {orders.map((order) => {
            const supplier = getSupplier(order.supplierId);
            const total = supplierTotals[order.supplierId] ?? 0;
            const itemCount = supplierItemCounts[order.supplierId] ?? 0;

            return (
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-item)',
                  border: '1px solid var(--color-border-subtle)',
                  background: 'var(--color-bg-surface)',
                  gap: '12px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {supplier.name}
                  </span>
                  <span
                    style={{
                      fontSize: '12px', fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    📦 {order.deliveryDate} · Sends {supplier.sendTime}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    £{total.toFixed(0)}
                  </span>
                  <span
                    style={{
                      fontSize: '12px', fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Done button */}
        <button
          type="button"
          onClick={onDone}
          style={{
            padding: '11px 40px',
            borderRadius: 'var(--radius-card)',
            border: 'none',
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(34,68,68,0.18)',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-deep)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-active)';
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

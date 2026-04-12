'use client';

import type { SuggestedOrder, DismissReason, ManualLine } from '../types';
import { getSupplier, getIngredient, getProduct, isUrgent } from '../data/mockOrders';
import LineItem from './LineItem';
import MovProgressBar from './MovProgressBar';
import QtyControl from './QtyControl';

interface Props {
  order: SuggestedOrder;
  quantities: Record<string, number>;
  removed: Set<string>;
  showDetail: boolean;
  supplierTotal: number;
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onRestore: (lineId: string) => void;
  onDismissReason: (lineId: string, reason: DismissReason) => void;
  manualLines?: ManualLine[];
  onManualLineQtyChange?: (id: string, qty: number) => void;
  onRemoveManualLine?: (id: string) => void;
}

export default function SupplierSection({
  order,
  quantities,
  removed,
  showDetail,
  supplierTotal,
  onQtyChange,
  onRemove,
  onRestore,
  onDismissReason,
  manualLines = [],
  onManualLineQtyChange,
  onRemoveManualLine,
}: Props) {
  const supplier = getSupplier(order.supplierId);
  const urgent = isUrgent(supplier);

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-surface)',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '14px 16px 12px',
          background: 'var(--color-bg-hover)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '15px',
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
                    background: 'rgba(185,28,28,0.10)',
                    color: '#B91C1C',
                    border: '1px solid rgba(185,28,28,0.25)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  URGENT — Due {supplier.cutOffTime}
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <span>📦 Arriving {order.deliveryDate}</span>
              <span>·</span>
              <span>Order by {supplier.cutOffTime}</span>
              {urgent && (
                <>
                  <span>·</span>
                  <span style={{ color: '#B91C1C', fontWeight: 600 }}>Review soon to make this delivery</span>
                </>
              )}
            </div>
          </div>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
              flexShrink: 0,
            }}
          >
            £{supplierTotal.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Line items */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {order.lines.map((line) => (
          <LineItem
            key={line.id}
            line={line}
            qty={quantities[line.id] ?? line.suggestedQty}
            removed={removed.has(line.id)}
            showDetail={showDetail}
            onQtyChange={(qty) => onQtyChange(line.id, qty)}
            onRemove={() => onRemove(line.id)}
            onRestore={() => onRestore(line.id)}
            onDismissReason={(reason) => onDismissReason(line.id, reason)}
          />
        ))}

        {/* Manually added lines for this supplier */}
        {manualLines.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--color-border-subtle)',
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Added by you
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  background: 'var(--color-border-subtle)',
                }}
              />
            </div>

            {manualLines.map((ml) => {
              const ingredient = getIngredient(ml.ingredientId);
              const product = getProduct(ml.ingredientId, ml.supplierId);
              const lineTotal = ml.qty * product.unitCost;
              return (
                <div
                  key={ml.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-item)',
                    border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-surface)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {ingredient.name}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {ingredient.variant} · {product.unitName}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexShrink: 0,
                    }}
                  >
                    <QtyControl
                      value={ml.qty}
                      onChange={(q) => onManualLineQtyChange?.(ml.id, q)}
                      min={1}
                      label={ingredient.name}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                        minWidth: '48px',
                        textAlign: 'right',
                      }}
                    >
                      £{lineTotal.toFixed(0)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${ingredient.name}`}
                      onClick={() => onRemoveManualLine?.(ml.id)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* MOV progress bar */}
      {supplier.minimumOrderValue > 0 && (
        <div style={{ padding: '0 16px 14px' }}>
          <MovProgressBar current={supplierTotal} minimum={supplier.minimumOrderValue} />
        </div>
      )}
    </div>
  );
}

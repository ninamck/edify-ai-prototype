'use client';

import { useState } from 'react';
import type { RecurringOrder } from '../types';
import { getVariancePercent, needsReview } from '../types';
import { getSupplier, getIngredient, getProduct } from '../data/mockOrders';
import QtyControl from './QtyControl';

interface Props {
  order: RecurringOrder;
  quantities: Record<string, number>;
  actions: Record<string, 'accepted' | 'reverted'>;
  onQtyChange: (lineId: string, qty: number) => void;
  onAccept: (lineId: string) => void;
  onRevert: (lineId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function RecurringOrderReview({
  order,
  quantities,
  actions,
  onQtyChange,
  onAccept,
  onRevert,
  onConfirm,
  onBack,
}: Props) {
  const supplier = getSupplier(order.supplierId);
  const [autoExpanded, setAutoExpanded] = useState(false);

  const reviewLines = order.lines.filter((l) => needsReview(l.recurringBaseQty, l.suggestedQty));
  const autoLines = order.lines.filter((l) => !needsReview(l.recurringBaseQty, l.suggestedQty));

  const allReviewActioned = reviewLines.every((l) => actions[l.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '80px' }}>
        <div
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            padding: '28px 24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ← Back
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  margin: 0,
                }}
              >
                {supplier.name}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-badge)',
                  background: 'rgba(34,68,68,0.08)',
                  color: 'var(--color-accent-active)',
                  fontSize: '12px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-primary)',
                  letterSpacing: '0.03em',
                }}
              >
                Daily recurring order
              </span>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                margin: '4px 0 0',
              }}
            >
              {reviewLines.length} item{reviewLines.length !== 1 ? 's' : ''} changed by more than 10% and need{reviewLines.length === 1 ? 's' : ''} your review.
              {autoLines.length > 0 && ` ${autoLines.length} item${autoLines.length !== 1 ? 's' : ''} unchanged.`}
            </p>
          </div>

          {/* Needs review section */}
          <div
            style={{
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(58,48,40,0.06)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--color-bg-hover)',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                Needs review
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {reviewLines.length} item{reviewLines.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {reviewLines.map((line) => {
                const ingredient = getIngredient(line.ingredientId);
                const product = getProduct(line.ingredientId, line.supplierId);
                const variance = getVariancePercent(line.recurringBaseQty, line.suggestedQty);
                const isUp = variance > 0;
                const qty = quantities[line.id] ?? line.suggestedQty;
                const action = actions[line.id];
                const lineTotal = qty * product.unitCost;

                return (
                  <div
                    key={line.id}
                    style={{
                      borderRadius: 'var(--radius-item)',
                      border: action
                        ? '1px solid rgba(21,128,61,0.25)'
                        : '1px solid var(--color-border-subtle)',
                      background: action
                        ? 'rgba(21,128,61,0.03)'
                        : 'var(--color-bg-surface)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    {/* Product info row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            {ingredient.name}
                          </span>
                          <VarianceBadge variance={variance} />
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{ingredient.variant}</span>
                          <span>·</span>
                          <span>
                            Was {line.recurringBaseQty} {product.unitName} → now {qty}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <QtyControl
                          value={qty}
                          onChange={(q) => onQtyChange(line.id, q)}
                          min={0}
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
                      </div>
                    </div>

                    {/* Reason + actions */}
                    <div
                      style={{
                        padding: '8px 14px 12px',
                        borderTop: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-primary)',
                          lineHeight: 1.5,
                          flex: 1,
                        }}
                      >
                        {line.reasons[0]}
                      </span>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {action === 'accepted' ? (
                          <span
                            style={{
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-item)',
                              background: 'rgba(21,128,61,0.10)',
                              color: '#15803D',
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            ✓ Accepted
                          </span>
                        ) : action === 'reverted' ? (
                          <span
                            style={{
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-item)',
                              background: 'var(--color-bg-hover)',
                              color: 'var(--color-text-secondary)',
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            Kept at {line.recurringBaseQty}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onAccept(line.id)}
                              style={{
                                padding: '5px 14px',
                                borderRadius: 'var(--radius-item)',
                                border: '1px solid rgba(21,128,61,0.30)',
                                background: 'rgba(21,128,61,0.08)',
                                color: '#15803D',
                                fontSize: '12px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(21,128,61,0.15)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(21,128,61,0.08)';
                              }}
                            >
                              Accept {isUp ? '↑' : '↓'} {line.suggestedQty}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRevert(line.id)}
                              style={{
                                padding: '5px 14px',
                                borderRadius: 'var(--radius-item)',
                                border: '1px solid var(--color-border-subtle)',
                                background: 'var(--color-bg-surface)',
                                color: 'var(--color-text-secondary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                fontFamily: 'var(--font-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-surface)';
                              }}
                            >
                              Keep at {line.recurringBaseQty}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Auto-updated section */}
          {autoLines.length > 0 && (
            <div
              style={{
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-surface)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setAutoExpanded((v) => !v)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--color-bg-hover)',
                  border: 'none',
                  borderBottom: autoExpanded ? '1px solid var(--color-border-subtle)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    No changes
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {autoLines.length} item{autoLines.length !== 1 ? 's' : ''} staying the same
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  {autoExpanded ? '▲' : '▼'}
                </span>
              </button>

              {autoExpanded && (
                <div
                  style={{
                    padding: '8px 16px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {autoLines.map((line) => {
                    const ingredient = getIngredient(line.ingredientId);
                    const product = getProduct(line.ingredientId, line.supplierId);
                    return (
                      <div
                        key={line.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-item)',
                          background: 'var(--color-bg-hover)',
                          opacity: 0.7,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-primary)',
                            }}
                          >
                            {ingredient.name}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-primary)',
                              marginLeft: '8px',
                            }}
                          >
                            {ingredient.variant}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          {line.recurringBaseQty} {product.unitName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ height: '16px' }} />
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--color-bg-surface)',
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 10,
          boxShadow: '0 -2px 12px rgba(58,48,40,0.08)',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {allReviewActioned
            ? 'All items reviewed'
            : `${reviewLines.filter((l) => !actions[l.id]).length} item${reviewLines.filter((l) => !actions[l.id]).length !== 1 ? 's' : ''} still need review`}
        </span>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!allReviewActioned}
          style={{
            padding: '11px 28px',
            borderRadius: 'var(--radius-card)',
            border: 'none',
            background: allReviewActioned ? '#15803D' : 'var(--color-bg-hover)',
            color: allReviewActioned ? '#fff' : 'var(--color-text-secondary)',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: allReviewActioned ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            boxShadow: allReviewActioned ? '0 2px 8px rgba(21,128,61,0.22)' : 'none',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (allReviewActioned) {
              (e.currentTarget as HTMLButtonElement).style.background = '#166534';
            }
          }}
          onMouseLeave={(e) => {
            if (allReviewActioned) {
              (e.currentTarget as HTMLButtonElement).style.background = '#15803D';
            }
          }}
        >
          Confirm updates
        </button>
      </div>
    </div>
  );
}

function VarianceBadge({ variance }: { variance: number }) {
  const isUp = variance > 0;
  const isDown = variance < 0;
  const isZero = variance === 0;

  const bg = isUp
    ? 'rgba(21,128,61,0.10)'
    : isDown
      ? 'rgba(185,28,28,0.10)'
      : 'var(--color-bg-hover)';
  const color = isUp
    ? '#15803D'
    : isDown
      ? '#B91C1C'
      : 'var(--color-text-secondary)';

  return (
    <span
      style={{
        padding: '2px 7px',
        borderRadius: 'var(--radius-badge)',
        background: bg,
        color: color,
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {isUp && '↑ '}
      {isDown && '↓ '}
      {isZero ? 'No change' : `${variance > 0 ? '+' : ''}${variance}%`}
    </span>
  );
}

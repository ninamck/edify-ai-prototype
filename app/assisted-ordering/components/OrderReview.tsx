'use client';

import { useState } from 'react';
import type { SuggestedOrder, GroupBy, DismissReason, ManualLine } from '../types';
import { getSupplier, getIngredient, getProduct, SUPPLIERS, isUrgent } from '../data/mockOrders';
import GroupToggle from './GroupToggle';
import DetailToggle from './DetailToggle';
import SupplierSection from './SupplierSection';
import LineItem from './LineItem';
import AddItemSheet from './AddItemSheet';
import QtyControl from './QtyControl';

interface Props {
  orders: SuggestedOrder[];
  quantities: Record<string, number>;
  removed: Set<string>;
  groupBy: GroupBy;
  showDetail: boolean;
  grandTotal: number;
  totalItems: number;
  editedCount: number;
  removedCount: number;
  supplierTotals: Record<string, number>;
  supplierItemCounts: Record<string, number>;
  onGroupByChange: (v: GroupBy) => void;
  onDetailToggle: (v: boolean) => void;
  onQtyChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onRestore: (lineId: string) => void;
  onDismissReason: (lineId: string, reason: DismissReason) => void;
  onConfirmAll: () => void;
  onBack: () => void;
  manualLines: ManualLine[];
  onAddItem: (ingredientId: string, supplierId: string, qty: number) => void;
  onRemoveManualLine: (id: string) => void;
  onManualLineQtyChange: (id: string, qty: number) => void;
}

// Oldest stocktake across all suggested order lines (for the banner)
function getStocktakeAge(orders: SuggestedOrder[]): number {
  let max = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.stockDataAgeDays > max) max = line.stockDataAgeDays;
    }
  }
  return max;
}

function dayLabel(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}

// ─── By Day view helpers ──────────────────────────────────────────────────────

function groupByDay(orders: SuggestedOrder[]) {
  const map = new Map<string, { date: string; orders: SuggestedOrder[] }>();
  for (const order of orders) {
    if (!map.has(order.deliveryDate)) {
      map.set(order.deliveryDate, { date: order.deliveryDate, orders: [] });
    }
    map.get(order.deliveryDate)!.orders.push(order);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── By Ingredient view helpers ───────────────────────────────────────────────

interface FlatLine {
  orderId: string;
  supplierId: string;
  line: SuggestedOrder['lines'][0];
  ingredientName: string;
}

function groupByIngredient(orders: SuggestedOrder[]): FlatLine[] {
  const lines: FlatLine[] = [];
  for (const order of orders) {
    for (const line of order.lines) {
      const ingredient = getIngredient(line.ingredientId);
      lines.push({ orderId: order.id, supplierId: order.supplierId, line, ingredientName: ingredient.name });
    }
  }
  lines.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  return lines;
}

export default function OrderReview({
  orders,
  quantities,
  removed,
  groupBy,
  showDetail,
  grandTotal,
  totalItems,
  editedCount,
  removedCount,
  supplierTotals,
  supplierItemCounts,
  onGroupByChange,
  onDetailToggle,
  onQtyChange,
  onRemove,
  onRestore,
  onDismissReason,
  onConfirmAll,
  onBack,
  manualLines,
  onAddItem,
  onRemoveManualLine,
  onManualLineQtyChange,
}: Props) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const stocktakeAge = getStocktakeAge(orders);
  const stocktakeDateStr = dayLabel(stocktakeAge);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Scrollable content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '80px', // leave room for sticky bar
        }}
      >
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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
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
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  margin: 0,
                }}
              >
                Review orders
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                  margin: '4px 0 0',
                }}
              >
                All items included by default. Edit quantities or remove what you don&apos;t need.
              </p>
            </div>
          </div>

          {/* Summary cards row */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {/* Grand total card */}
            <div
              style={{
                flex: '0 0 auto',
                padding: '14px 18px',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-accent-active)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: '140px',
              }}
            >
              <span style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-primary)' }}>
                £{grandTotal.toFixed(0)}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-primary)', opacity: 0.85 }}>
                {totalItems} items · {orders.length} supplier{orders.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Per-supplier mini cards */}
            {orders.map((order) => {
              const supplier = getSupplier(order.supplierId);
              const urgent = isUrgent(supplier);
              const total = supplierTotals[order.supplierId] ?? 0;
              return (
                <div
                  key={order.id}
                  style={{
                    flex: '0 0 auto',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: urgent
                      ? '1.5px solid rgba(185,28,28,0.30)'
                      : '1px solid var(--color-border-subtle)',
                    background: urgent ? 'rgba(185,28,28,0.03)' : 'var(--color-bg-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    minWidth: '120px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {supplier.name}
                    </span>
                    {urgent && (
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#B91C1C' }}>●</span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: urgent ? '#B91C1C' : 'var(--color-text-primary)',
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
                    {order.deliveryDate}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Toggles row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <GroupToggle value={groupBy} onChange={onGroupByChange} />
            <DetailToggle value={showDetail} onChange={onDetailToggle} />
          </div>

          {/* Stocktake banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-item)',
              background: 'rgba(34,68,68,0.06)',
              border: '1px solid rgba(34,68,68,0.15)',
              fontSize: '12px', fontWeight: 500,
              color: 'var(--color-accent-active)',
              fontFamily: 'var(--font-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📋</span>
            <span>
              Stock levels from most recent stocktake ({stocktakeDateStr})
              {stocktakeAge > 7 && (
                <strong style={{ color: '#B91C1C', marginLeft: '6px' }}>
                  — consider running a new stocktake to improve accuracy
                </strong>
              )}
            </span>
          </div>

          {/* Content by grouping mode */}
          {groupBy === 'supplier' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {orders.map((order) => (
                <SupplierSection
                  key={order.id}
                  order={order}
                  quantities={quantities}
                  removed={removed}
                  showDetail={showDetail}
                  supplierTotal={supplierTotals[order.supplierId] ?? 0}
                  onQtyChange={onQtyChange}
                  onRemove={onRemove}
                  onRestore={onRestore}
                  onDismissReason={onDismissReason}
                  manualLines={manualLines.filter((ml) => ml.supplierId === order.supplierId)}
                  onManualLineQtyChange={onManualLineQtyChange}
                  onRemoveManualLine={onRemoveManualLine}
                />
              ))}
            </div>
          )}

          {groupBy === 'day' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {groupByDay(orders).map(({ date, orders: dayOrders }) => {
                const supplierNames = dayOrders.map((o) => getSupplier(o.supplierId).name).join(', ');
                const dayItemCount = dayOrders.reduce((sum, o) => {
                  return sum + o.lines.filter((l) => !removed.has(l.id)).length;
                }, 0);

                return (
                  <div key={date}>
                    {/* Day header */}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-item) var(--radius-item) 0 0',
                        background: 'var(--color-bg-hover)',
                        border: '1px solid var(--color-border-subtle)',
                        borderBottom: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>📦</span> Arriving {date}
                      </span>
                      <span
                        style={{
                          fontSize: '12px', fontWeight: 500,
                          color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        {dayItemCount} item{dayItemCount !== 1 ? 's' : ''} · {supplierNames}
                      </span>
                    </div>

                    {/* Lines for all orders on this day */}
                    <div
                      style={{
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '0 0 var(--radius-item) var(--radius-item)',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: 'var(--color-bg-surface)',
                      }}
                    >
                      {dayOrders.flatMap((order) =>
                        order.lines.map((line) => {
                          const supplier = getSupplier(order.supplierId);
                          return (
                            <div key={line.id}>
                              {/* Supplier badge per line in day view */}
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: 'var(--color-text-secondary)',
                                  fontFamily: 'var(--font-primary)',
                                  marginBottom: '3px',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {supplier.name}
                              </div>
                              <LineItem
                                line={line}
                                qty={quantities[line.id] ?? line.suggestedQty}
                                removed={removed.has(line.id)}
                                showDetail={showDetail}
                                onQtyChange={(qty) => onQtyChange(line.id, qty)}
                                onRemove={() => onRemove(line.id)}
                                onRestore={() => onRestore(line.id)}
                                onDismissReason={(reason) => onDismissReason(line.id, reason)}
                              />
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {groupBy === 'ingredient' && (
            <div
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                overflow: 'hidden',
                background: 'var(--color-bg-surface)',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {groupByIngredient(orders).map(({ line, supplierId }) => {
                  const supplier = getSupplier(supplierId);
                  const order = orders.find((o) => o.supplierId === supplierId)!;
                  return (
                    <div key={line.id}>
                      {/* Supplier + delivery badges */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          marginBottom: '3px',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-primary)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {supplier.name}
                        </span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-badge)',
                            background: 'var(--color-bg-hover)',
                            color: 'var(--color-text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          📦 {order.deliveryDate}
                        </span>
                      </div>
                      <LineItem
                        line={line}
                        qty={quantities[line.id] ?? line.suggestedQty}
                        removed={removed.has(line.id)}
                        showDetail={showDetail}
                        onQtyChange={(qty) => onQtyChange(line.id, qty)}
                        onRemove={() => onRemove(line.id)}
                        onRestore={() => onRestore(line.id)}
                        onDismissReason={(reason) => onDismissReason(line.id, reason)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New-supplier manual lines — shown as separate sections */}
          {manualLines.some((ml) => !orders.map((o) => o.supplierId).includes(ml.supplierId)) && (() => {
            // Only lines for suppliers NOT already in the order
            const newSupplierLines = manualLines.filter(
              (ml) => !orders.map((o) => o.supplierId).includes(ml.supplierId),
            );
            const grouped = new Map<string, typeof manualLines>();
            for (const ml of newSupplierLines) {
              if (!grouped.has(ml.supplierId)) grouped.set(ml.supplierId, []);
              grouped.get(ml.supplierId)!.push(ml);
            }
            const existingIds = orders.map((o) => o.supplierId);

            return Array.from(grouped.entries()).map(([supplierId, lines]) => {
              const supplier = getSupplier(supplierId);
              const isNew = !existingIds.includes(supplierId);
              return (
                <div key={supplierId}>
                  {/* Supplier header */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-item) var(--radius-item) 0 0',
                      background: isNew ? 'rgba(146,64,14,0.06)' : 'var(--color-bg-hover)',
                      border: isNew
                        ? '1px solid rgba(146,64,14,0.22)'
                        : '1px solid var(--color-border-subtle)',
                      borderBottom: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isNew ? '#92400E' : 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                      }}
                    >
                      {supplier.name}
                    </span>
                    {isNew && (
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-badge)',
                          background: 'rgba(146,64,14,0.12)',
                          color: '#92400E',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-primary)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        NEW SUPPLIER
                      </span>
                    )}
                    {isNew && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#92400E',
                          fontFamily: 'var(--font-primary)',
                          marginLeft: '2px',
                        }}
                      >
                        · 📦 {supplier.deliveryDate} · cutoff {supplier.cutOffTime}
                      </span>
                    )}
                  </div>

                  {/* Lines */}
                  <div
                    style={{
                      border: isNew
                        ? '1px solid rgba(146,64,14,0.22)'
                        : '1px solid var(--color-border-subtle)',
                      borderRadius: '0 0 var(--radius-item) var(--radius-item)',
                      background: 'var(--color-bg-surface)',
                      overflow: 'hidden',
                    }}
                  >
                    {lines.map((ml, i) => {
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
                            borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
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
                              onChange={(q) => onManualLineQtyChange(ml.id, q)}
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
                              onClick={() => onRemoveManualLine(ml.id)}
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
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  'transparent';
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {/* Add item — inline dropdown */}
          {showAddSheet ? (
            <AddItemSheet
              onClose={() => setShowAddSheet(false)}
              onAdd={onAddItem}
              existingSupplierIds={orders.map((o) => o.supplierId)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddSheet(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-card)',
                border: '1.5px dashed var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'var(--color-bg-hover)';
                el.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'transparent';
                el.style.color = 'var(--color-text-secondary)';
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add item
            </button>
          )}

          {/* Bottom padding */}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px', fontWeight: 500,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <strong style={{ color: 'var(--color-text-primary)' }}>{totalItems}</strong> items
          </span>
          {editedCount > 0 && (
            <>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--color-accent-active)' }}>{editedCount}</strong> edited
              </span>
            </>
          )}
          {removedCount > 0 && (
            <>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{removedCount}</strong> removed
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onConfirmAll}
          style={{
            padding: '11px 28px',
            borderRadius: 'var(--radius-card)',
            border: 'none',
            background: '#15803D',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(21,128,61,0.22)',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#166534';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#15803D';
          }}
        >
          Confirm all — £{grandTotal.toFixed(0)}
        </button>
      </div>
    </div>
  );
}

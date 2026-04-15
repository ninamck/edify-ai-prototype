'use client';

import { useState } from 'react';
import type { SuggestedOrder, GroupBy, DismissReason, ManualLine, RecurringOrder } from '../types';
import { getVariancePercent, needsReview, recurringFrequencyBadgeLabel, sentenceCaseFrequency } from '../types';
import { getSupplier, getIngredient, getProduct, SUPPLIERS, SUPPLIER_PRODUCTS, isUrgent } from '../data/mockOrders';
import GroupToggle from './GroupToggle';
import DetailToggle from './DetailToggle';
import SupplierSection from './SupplierSection';
import LineItem from './LineItem';
import AddItemSheet from './AddItemSheet';
import MovProgressBar from './MovProgressBar';
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
  recurringOrders: RecurringOrder[];
  recurringQtys: Record<string, number>;
  recurringActions: Record<string, 'accepted' | 'reverted'>;
  onRecurringQtyChange: (lineId: string, qty: number) => void;
  onRecurringAccept: (lineId: string) => void;
  onRecurringRevert: (lineId: string) => void;
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

// ─── New-supplier section with MOV top-up flow ──────────────────────────────

import type { Supplier, SupplierProduct } from '../types';

function NewSupplierSection({
  supplierId,
  supplier,
  lines,
  isNew,
  sectionTotal,
  mov,
  movMet,
  shortfall,
  topUpProducts,
  onManualLineQtyChange,
  onRemoveManualLine,
  onAddItem,
}: {
  supplierId: string;
  supplier: Supplier;
  lines: ManualLine[];
  isNew: boolean;
  sectionTotal: number;
  mov: number;
  movMet: boolean;
  shortfall: number;
  topUpProducts: SupplierProduct[];
  onManualLineQtyChange: (id: string, qty: number) => void;
  onRemoveManualLine: (id: string) => void;
  onAddItem: (ingredientId: string, supplierId: string, qty: number) => void;
}) {
  const [showTopUp, setShowTopUp] = useState(false);

  return (
    <div>
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
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
              ADDED TO ORDER
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
        <span
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
            flexShrink: 0,
          }}
        >
          £{sectionTotal.toFixed(0)}
        </span>
      </div>

      {/* Lines + MOV */}
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

        {/* MOV progress bar */}
        {mov > 0 && (
          <div style={{ padding: '4px 14px 14px' }}>
            <MovProgressBar current={sectionTotal} minimum={mov} />

            {/* Top-up prompt when MOV not met */}
            {!movMet && topUpProducts.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                {!showTopUp ? (
                  <button
                    type="button"
                    onClick={() => setShowTopUp(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-item)',
                      border: '1.5px dashed rgba(146,64,14,0.35)',
                      background: 'rgba(146,64,14,0.04)',
                      color: '#92400E',
                      fontSize: '13px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.12s ease, border-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = 'rgba(146,64,14,0.08)';
                      el.style.borderColor = 'rgba(146,64,14,0.50)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = 'rgba(146,64,14,0.04)';
                      el.style.borderColor = 'rgba(146,64,14,0.35)';
                    }}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                    Add £{shortfall.toFixed(0)} more to reach minimum
                  </button>
                ) : (
                  <div
                    style={{
                      borderRadius: 'var(--radius-item)',
                      border: '1px solid rgba(146,64,14,0.22)',
                      background: 'rgba(146,64,14,0.03)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid rgba(146,64,14,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#92400E',
                          fontFamily: 'var(--font-primary)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        Add items to reach £{mov} minimum
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTopUp(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text-secondary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontFamily: 'var(--font-primary)',
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ padding: '6px 0' }}>
                      {topUpProducts.map((product) => {
                        const ingredient = getIngredient(product.ingredientId);
                        return (
                          <div
                            key={product.ingredientId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              gap: '10px',
                              transition: 'background 0.1s ease',
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
                                  margin: '1px 0 0',
                                  fontSize: '12px',
                                  color: 'var(--color-text-secondary)',
                                  fontFamily: 'var(--font-primary)',
                                }}
                              >
                                {product.unitName} · £{product.unitCost}
                                {ingredient.currentStock <= (ingredient.parLevel ?? 0) * 0.5 && (
                                  <span style={{ color: '#B91C1C', fontWeight: 600, marginLeft: '6px' }}>
                                    Low stock ({ingredient.currentStock}{ingredient.stockUnit})
                                  </span>
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onAddItem(product.ingredientId, supplierId, 1);
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-item)',
                                border: '1px solid rgba(146,64,14,0.30)',
                                background: 'rgba(146,64,14,0.08)',
                                color: '#92400E',
                                fontSize: '12px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-primary)',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'background 0.12s ease',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(146,64,14,0.15)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(146,64,14,0.08)';
                              }}
                            >
                              + Add · £{product.unitCost}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recurring order inline section ──────────────────────────────────────────

import type { Supplier as SupplierType, RecurringOrderLine } from '../types';

function RecurringOrderSection({
  order,
  supplier,
  reviewLines,
  autoLines,
  quantities,
  actions,
  onQtyChange,
  onAccept,
  onRevert,
}: {
  order: RecurringOrder;
  supplier: SupplierType;
  reviewLines: RecurringOrderLine[];
  autoLines: RecurringOrderLine[];
  quantities: Record<string, number>;
  actions: Record<string, 'accepted' | 'reverted'>;
  onQtyChange: (lineId: string, qty: number) => void;
  onAccept: (lineId: string) => void;
  onRevert: (lineId: string) => void;
}) {
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [autoLineEditIds, setAutoLineEditIds] = useState<Set<string>>(() => new Set());

  const toggleAutoLineEdit = (lineId: string) => {
    setAutoLineEditIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid rgba(34,68,68,0.20)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-badge)',
                background: 'rgba(34,68,68,0.08)',
                color: 'var(--color-accent-active)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                fontFamily: 'var(--font-primary)',
                textTransform: 'none',
              }}
            >
              {recurringFrequencyBadgeLabel(order.frequency)}
            </span>
          </div>
        </div>
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {reviewLines.length} item{reviewLines.length !== 1 ? 's' : ''} changed {'>'}10% — review below
        </div>
      </div>

      {/* Review lines */}
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
                    <RecurringVarianceBadge variance={variance} />
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
                    <span>Was {line.recurringBaseQty} {product.unitName} → now {qty}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <QtyControl value={qty} onChange={(q) => onQtyChange(line.id, q)} min={0} label={ingredient.name} />
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

              {/* Detail + Why + actions */}
              <RecurringLineDetail
                line={line}
                qty={qty}
                variance={variance}
                isUp={isUp}
                action={action}
                product={product}
                ingredient={ingredient}
                onAccept={onAccept}
                onRevert={onRevert}
              />
            </div>
          );
        })}

        {/* Auto-updated / unchanged lines */}
        {autoLines.length > 0 && (
          <div
            style={{
              borderRadius: 'var(--radius-item)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setAutoExpanded((v) => !v)}
              style={{
                width: '100%',
                padding: '10px 14px',
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
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {autoLines.length} item{autoLines.length !== 1 ? 's' : ''} unchanged
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {autoExpanded ? '▲' : '▼'}
              </span>
            </button>
            {autoExpanded && (
              <div style={{ padding: '6px 14px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {autoLines.map((line) => {
                  const ingredient = getIngredient(line.ingredientId);
                  const product = getProduct(line.ingredientId, line.supplierId);
                  const qty = quantities[line.id] ?? line.suggestedQty;
                  const lineTotal = qty * product.unitCost;
                  const editing = autoLineEditIds.has(line.id);
                  const variance = getVariancePercent(line.recurringBaseQty, qty);

                  return (
                    <div
                      key={line.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-item)',
                        border: '1px solid var(--color-border-subtle)',
                        background: editing ? 'var(--color-bg-surface)' : 'transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          {ingredient.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--color-text-secondary)',
                            fontFamily: 'var(--font-primary)',
                            marginTop: '2px',
                          }}
                        >
                          {ingredient.variant}
                          <span style={{ margin: '0 4px' }}>·</span>
                          Recurring {line.recurringBaseQty} {product.unitName}
                          {qty !== line.recurringBaseQty && (
                            <>
                              <span style={{ margin: '0 4px' }}>→</span>
                              {qty} {product.unitName}
                              <span style={{ marginLeft: '6px', fontWeight: 700, color: 'var(--color-accent-active)' }}>
                                ({variance > 0 ? '+' : ''}
                                {variance}%)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {editing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          <QtyControl value={qty} onChange={(q) => onQtyChange(line.id, q)} min={0} label={ingredient.name} />
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-primary)',
                              minWidth: '44px',
                              textAlign: 'right',
                            }}
                          >
                            £{lineTotal.toFixed(0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAutoLineEdit(line.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-badge)',
                              border: '1px solid var(--color-border-subtle)',
                              background: 'var(--color-bg-hover)',
                              color: 'var(--color-text-secondary)',
                              fontSize: '11px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-primary)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {qty} {product.unitName}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--color-text-primary)',
                              fontFamily: 'var(--font-primary)',
                              minWidth: '40px',
                              textAlign: 'right',
                            }}
                          >
                            £{lineTotal.toFixed(0)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Edit quantity for ${ingredient.name}`}
                            title="Edit quantity"
                            onClick={() => toggleAutoLineEdit(line.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg-surface)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RecurringLineDetail({
  line,
  qty,
  variance,
  isUp,
  action,
  product,
  ingredient,
  onAccept,
  onRevert,
}: {
  line: RecurringOrderLine;
  qty: number;
  variance: number;
  isUp: boolean;
  action: 'accepted' | 'reverted' | undefined;
  product: { unitName: string };
  ingredient: { currentStock: number; stockUnit: string; parLevel: number | null; parConfirmed: boolean };
  onAccept: (lineId: string) => void;
  onRevert: (lineId: string) => void;
}) {
  const [whyExpanded, setWhyExpanded] = useState(false);

  return (
    <div
      style={{
        padding: '0 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderTop: '1px solid var(--color-border-subtle)',
        paddingTop: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '12px', fontWeight: 500,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Recurring: {line.recurringBaseQty} {product.unitName} →{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{qty} {product.unitName}</strong>
        </span>

        <button
          type="button"
          onClick={() => setWhyExpanded((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-accent-active)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {whyExpanded ? 'Hide ▲' : 'Why? ▼'}
        </button>

        {/* Accept / revert actions */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {action === 'accepted' ? (
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-badge)',
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
                padding: '4px 12px',
                borderRadius: 'var(--radius-badge)',
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
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-badge)',
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
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-badge)',
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

      {whyExpanded && (
        <ul
          style={{
            margin: '6px 0 0 0',
            padding: '10px 14px',
            background: 'var(--color-bg-hover)',
            borderRadius: 'var(--radius-item)',
            listStyle: 'disc',
            paddingLeft: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {line.reasons.map((text, i) => (
            <li
              key={i}
              style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)',
                lineHeight: 1.5,
              }}
            >
              {text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecurringVarianceBadge({ variance }: { variance: number }) {
  const isUp = variance > 0;
  const isDown = variance < 0;

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
      {isUp && '↑ '}{isDown && '↓ '}
      {variance === 0 ? 'No change' : `${variance > 0 ? '+' : ''}${variance}%`}
    </span>
  );
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
  recurringOrders,
  recurringQtys,
  recurringActions,
  onRecurringQtyChange,
  onRecurringAccept,
  onRecurringRevert,
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
              overflowX: 'auto',
              flexWrap: 'nowrap',
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

            {/* Recurring order mini cards */}
            {recurringOrders.map((recOrder) => {
              const recSupplier = getSupplier(recOrder.supplierId);
              const reviewCount = recOrder.lines.filter((l) => needsReview(l.recurringBaseQty, l.suggestedQty)).length;
              const recTotal = recOrder.lines.reduce((sum, l) => {
                const p = getProduct(l.ingredientId, l.supplierId);
                const q = recurringQtys[l.id] ?? l.suggestedQty;
                return sum + q * p.unitCost;
              }, 0);
              return (
                <div
                  key={recOrder.id}
                  style={{
                    flex: '0 0 auto',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid rgba(34,68,68,0.20)',
                    background: 'var(--color-bg-surface)',
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
                      {recSupplier.name}
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-badge)',
                        background: 'rgba(34,68,68,0.08)',
                        color: 'var(--color-accent-active)',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        fontFamily: 'var(--font-primary)',
                        textTransform: 'none',
                      }}
                    >
                      {recurringFrequencyBadgeLabel(recOrder.frequency)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    £{recTotal.toFixed(0)}
                  </span>
                  <span
                    style={{
                      fontSize: '12px', fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {reviewCount} to review · {sentenceCaseFrequency(recOrder.frequency)}
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
                        [...order.lines].sort((a, b) => getIngredient(a.ingredientId).name.localeCompare(getIngredient(b.ingredientId).name)).map((line) => {
                          const supplier = getSupplier(order.supplierId);
                          return (
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
                              supplierName={supplier.name}
                            />
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
                      supplierName={supplier.name}
                      deliveryDate={order.deliveryDate}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* New-supplier manual lines — shown as separate sections with MOV */}
          {manualLines.some((ml) => !orders.map((o) => o.supplierId).includes(ml.supplierId)) && (() => {
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
              const sectionTotal = lines.reduce((sum, ml) => {
                const product = getProduct(ml.ingredientId, ml.supplierId);
                return sum + ml.qty * product.unitCost;
              }, 0);
              const mov = supplier.minimumOrderValue;
              const movMet = mov === 0 || sectionTotal >= mov;
              const shortfall = mov > 0 ? mov - sectionTotal : 0;
              const alreadyAddedIngredientIds = lines.map((ml) => ml.ingredientId);
              const topUpProducts = SUPPLIER_PRODUCTS.filter(
                (p) => p.supplierId === supplierId && p.available && !alreadyAddedIngredientIds.includes(p.ingredientId),
              );

              return (
                <NewSupplierSection
                  key={supplierId}
                  supplierId={supplierId}
                  supplier={supplier}
                  lines={lines}
                  isNew={isNew}
                  sectionTotal={sectionTotal}
                  mov={mov}
                  movMet={movMet}
                  shortfall={shortfall}
                  topUpProducts={topUpProducts}
                  onManualLineQtyChange={onManualLineQtyChange}
                  onRemoveManualLine={onRemoveManualLine}
                  onAddItem={onAddItem}
                />
              );
            });
          })()}

          {/* Recurring order sections */}
          {recurringOrders.map((recOrder) => {
            const recSupplier = getSupplier(recOrder.supplierId);
            const reviewLines = recOrder.lines.filter((l) => needsReview(l.recurringBaseQty, l.suggestedQty));
            const autoLines = recOrder.lines.filter((l) => !needsReview(l.recurringBaseQty, l.suggestedQty));

            return (
              <RecurringOrderSection
                key={recOrder.id}
                order={recOrder}
                supplier={recSupplier}
                reviewLines={reviewLines}
                autoLines={autoLines}
                quantities={recurringQtys}
                actions={recurringActions}
                onQtyChange={onRecurringQtyChange}
                onAccept={onRecurringAccept}
                onRevert={onRecurringRevert}
              />
            );
          })}

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

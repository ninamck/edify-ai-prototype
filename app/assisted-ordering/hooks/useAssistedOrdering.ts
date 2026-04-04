'use client';

import { useState, useCallback, useMemo } from 'react';
import type { GroupBy, View, DismissReason } from '../types';
import { SUGGESTED_ORDERS, SUPPLIERS, getIngredient, getProduct } from '../data/mockOrders';

// ─── Derived per-line values ──────────────────────────────────────────────────

export function getLineTotal(lineId: string, qty: number): number {
  for (const order of SUGGESTED_ORDERS) {
    const line = order.lines.find((l) => l.id === lineId);
    if (line) {
      const product = getProduct(line.ingredientId, line.supplierId);
      return qty * product.unitCost;
    }
  }
  return 0;
}

export function getProjectedStock(lineId: string, qty: number): number {
  for (const order of SUGGESTED_ORDERS) {
    const line = order.lines.find((l) => l.id === lineId);
    if (line) {
      const ingredient = getIngredient(line.ingredientId);
      const product = getProduct(line.ingredientId, line.supplierId);
      return ingredient.currentStock + qty * product.unitSize;
    }
  }
  return 0;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssistedOrdering() {
  const [view, setView] = useState<View>('notifications');
  const [groupBy, setGroupBy] = useState<GroupBy>('supplier');
  const [showDetail, setShowDetail] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const order of SUGGESTED_ORDERS) {
      for (const line of order.lines) {
        init[line.id] = line.suggestedQty;
      }
    }
    return init;
  });
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [dismissReasons, setDismissReasons] = useState<Record<string, DismissReason>>({});
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ─── Quantity actions ─────────────────────────────────────────────────────

  const setQty = useCallback((lineId: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [lineId]: Math.max(0, qty) }));
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setRemoved((prev) => new Set([...prev, lineId]));
  }, []);

  const restoreItem = useCallback((lineId: string) => {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(lineId);
      return next;
    });
    setDismissReasons((prev) => {
      const next = { ...prev };
      delete next[lineId];
      return next;
    });
  }, []);

  const setDismissReason = useCallback((lineId: string, reason: DismissReason) => {
    setDismissReasons((prev) => ({ ...prev, [lineId]: reason }));
  }, []);

  // ─── Derived values ───────────────────────────────────────────────────────

  const derived = useMemo(() => {
    let grandTotal = 0;
    let totalItems = 0;
    let editedCount = 0;

    const supplierTotals: Record<string, number> = {};
    const supplierItemCounts: Record<string, number> = {};

    for (const order of SUGGESTED_ORDERS) {
      let supplierTotal = 0;
      let supplierItemCount = 0;

      for (const line of order.lines) {
        if (removed.has(line.id)) continue;
        const qty = quantities[line.id] ?? line.suggestedQty;
        const product = getProduct(line.ingredientId, line.supplierId);
        const lineTotal = qty * product.unitCost;
        supplierTotal += lineTotal;
        supplierItemCount += 1;
        if (qty !== line.suggestedQty) editedCount += 1;
      }

      supplierTotals[order.supplierId] = supplierTotal;
      supplierItemCounts[order.supplierId] = supplierItemCount;
      grandTotal += supplierTotal;
      totalItems += supplierItemCount;
    }

    const movMet: Record<string, boolean> = {};
    for (const supplier of SUPPLIERS) {
      movMet[supplier.id] =
        supplier.minimumOrderValue === 0 ||
        (supplierTotals[supplier.id] ?? 0) >= supplier.minimumOrderValue;
    }

    const removedCount = removed.size;

    return {
      grandTotal,
      totalItems,
      editedCount,
      removedCount,
      supplierTotals,
      supplierItemCounts,
      movMet,
    };
  }, [quantities, removed]);

  // ─── Action logger stub ───────────────────────────────────────────────────

  const logAction = useCallback(
    (lineId: string, action: string, extra?: Record<string, unknown>) => {
      console.log('[AssistedOrdering]', action, lineId, extra ?? '');
    },
    [],
  );

  const confirmAll = useCallback(() => {
    for (const order of SUGGESTED_ORDERS) {
      for (const line of order.lines) {
        if (removed.has(line.id)) {
          logAction(line.id, 'dismissed', { reason: dismissReasons[line.id] });
        } else {
          const qty = quantities[line.id] ?? line.suggestedQty;
          if (qty !== line.suggestedQty) {
            logAction(line.id, 'edited', { from: line.suggestedQty, to: qty });
          } else {
            logAction(line.id, 'accepted');
          }
        }
      }
    }
    setView('confirmed');
  }, [quantities, removed, dismissReasons, logAction]);

  return {
    // State
    view,
    setView,
    groupBy,
    setGroupBy,
    showDetail,
    setShowDetail,
    quantities,
    setQty,
    removed,
    removeItem,
    restoreItem,
    dismissReasons,
    setDismissReason,
    bannerDismissed,
    setBannerDismissed,
    // Derived
    ...derived,
    // Actions
    confirmAll,
    logAction,
  };
}

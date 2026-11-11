'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { buildFixtures, cutOffFor, lineFromProduct, newOrderFor, type Fixtures } from './fixtures';
import { toBase } from './format';
import type { BasketLine, BasketOrder, CatalogueProduct } from './types';

export type Step = 'basket' | 'checkout' | 'sent';
export type Mode = 'predictive' | 'manual';
export type LineReasons = { picked: string[]; other?: string };

export type SentSummary = {
  suppliers: number;
  lines: number;
  total: number;
  sent: string[];
  awaitingApproval: string[];
  deliveryDates: string[];
};

export type ActiveOrder = BasketOrder & {
  activeLines: BasketLine[];
  total: number;
  deliveryDate: string | null;
};

export function useBasket(now: Date) {
  const fixtures = useMemo<Fixtures>(() => buildFixtures(now), [now]);
  const startQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of fixtures.orders) for (const line of order.lines) map[line.id] = line.startQuantity;
    return map;
  }, [fixtures]);
  const startRemoved = useMemo(
    () => new Set(fixtures.orders.flatMap((o) => o.lines.filter((l) => l.startsRemoved).map((l) => l.id))),
    [fixtures],
  );

  const [step, setStep] = useState<Step>('basket');
  const [mode, setMode] = useState<Mode>('predictive');
  const [quantities, setQuantities] = useState<Record<string, number>>(startQuantities);
  const [removed, setRemoved] = useState<Set<string>>(startRemoved);
  const [stopped, setStopped] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, LineReasons>>({});
  const [addedLines, setAddedLines] = useState<Record<string, BasketLine[]>>({});
  const [builtOrders, setBuiltOrders] = useState<BasketOrder[]>([]);
  const [dates, setDates] = useState<Record<string, string | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<SentSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const suggestedOrders = useMemo<BasketOrder[]>(
    () => fixtures.orders.map((o) => ({ ...o, lines: [...o.lines, ...(addedLines[o.id] ?? [])] })),
    [fixtures, addedLines],
  );

  /** Orders on screen right now. Predictive orders are set aside in manual mode. */
  const visibleOrders = useMemo<ActiveOrder[]>(() => {
    const source = mode === 'predictive' ? [...suggestedOrders, ...builtOrders] : builtOrders;
    return source.map((order) => {
      const activeLines = order.lines.filter((l) => !removed.has(l.id) && !stopped.has(l.id) && (quantities[l.id] ?? 0) > 0);
      const total = activeLines.reduce((sum, l) => sum + (quantities[l.id] ?? 0) * l.unitPrice, 0);
      const deliveryDate = order.id in dates ? dates[order.id] : order.deliveryDate;
      const supplier = fixtures.suppliers.find((s) => s.id === order.supplierId);
      const cutOffAt = deliveryDate && supplier ? cutOffFor(supplier, deliveryDate) : order.cutOffAt;
      return { ...order, activeLines, total, deliveryDate, cutOffAt };
    });
  }, [mode, suggestedOrders, builtOrders, removed, stopped, quantities, dates, fixtures]);

  const ordersWithLines = visibleOrders.filter((o) => o.activeLines.length > 0);
  const basketTotal = ordersWithLines.reduce((sum, o) => sum + toBase(o.total, o.currency), 0);
  const predictiveCount = fixtures.orders.length;

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    const next = Math.max(0, Math.round(quantity * 10) / 10);
    setQuantities((prev) => ({ ...prev, [lineId]: next }));
    if (next === 0) setRemoved((prev) => new Set(prev).add(lineId));
  }, []);

  const removeLine = useCallback((order: BasketOrder, line: BasketLine) => {
    if (line.addedByYou && line.id.startsWith('line-added-')) {
      setAddedLines((prev) => ({ ...prev, [order.id]: (prev[order.id] ?? []).filter((l) => l.id !== line.id) }));
      setBuiltOrders((prev) =>
        prev
          .map((o) => (o.id === order.id ? { ...o, lines: o.lines.filter((l) => l.id !== line.id) } : o))
          .filter((o) => o.lines.length > 0),
      );
      showToast(`${line.name} removed`);
      return;
    }
    setRemoved((prev) => new Set(prev).add(line.id));
  }, [showToast]);

  const undoRemove = useCallback((line: BasketLine) => {
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(line.id);
      return next;
    });
    setStopped((prev) => {
      const next = new Set(prev);
      next.delete(line.id);
      return next;
    });
    setQuantities((prev) => ({ ...prev, [line.id]: prev[line.id] > 0 ? prev[line.id] : Math.max(1, line.suggested) }));
    setReasons((prev) => {
      const next = { ...prev };
      delete next[line.id];
      return next;
    });
  }, []);

  const stopSuggesting = useCallback((line: BasketLine) => {
    setStopped((prev) => new Set(prev).add(line.id));
    showToast(`Edify won't suggest ${line.name} at ${fixtures.siteName}`);
  }, [fixtures.siteName, showToast]);

  const setLineReasons = useCallback((lineId: string, value: LineReasons) => {
    setReasons((prev) => ({ ...prev, [lineId]: value }));
  }, []);

  const inBasket = useCallback(
    (productId: string) => visibleOrders.some((o) => o.activeLines.some((l) => l.productId === productId)),
    [visibleOrders],
  );

  const addProduct = useCallback((item: CatalogueProduct) => {
    const line = lineFromProduct(item, fixtures.today, now);
    setQuantities((prev) => ({ ...prev, [line.id]: 1 }));
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(line.id);
      return next;
    });

    const existing = mode === 'predictive' ? fixtures.orders.find((o) => o.supplierId === item.supplierId) : undefined;
    const matchingFixture = existing?.lines.find((l) => l.productId === item.productId);
    if (existing && matchingFixture) {
      undoRemove(matchingFixture);
      showToast(`${item.name} is back in your ${existing.supplierName} order`);
      return;
    }
    if (existing) {
      setAddedLines((prev) => ({ ...prev, [existing.id]: [...(prev[existing.id] ?? []), line] }));
      showToast(`${item.name} added to your ${existing.supplierName} order`);
      return;
    }
    const supplier = fixtures.suppliers.find((s) => s.id === item.supplierId);
    if (!supplier) return;
    setBuiltOrders((prev) => {
      const current = prev.find((o) => o.supplierId === supplier.id);
      if (current) {
        if (current.lines.some((l) => l.id === line.id)) return prev;
        return prev.map((o) => (o.id === current.id ? { ...o, lines: [...o.lines, line] } : o));
      }
      return [...prev, { ...newOrderFor(supplier, fixtures.today, now), lines: [line] }];
    });
    showToast(`${item.name} added to a new ${supplier.name} order`);
  }, [fixtures, mode, now, showToast, undoRemove]);

  const clearBasket = useCallback(() => {
    setMode('manual');
    setBuiltOrders([]);
    setAddedLines({});
    showToast('Basket cleared');
  }, [showToast]);

  const switchMode = useCallback((next: Mode) => setMode(next), []);

  const setDeliveryDate = useCallback((orderId: string, date: string | null) => {
    setDates((prev) => ({ ...prev, [orderId]: date }));
  }, []);

  const setNote = useCallback((orderId: string, note: string) => {
    setNotes((prev) => ({ ...prev, [orderId]: note }));
  }, []);

  const placeOrders = useCallback(() => {
    const summary: SentSummary = {
      suppliers: ordersWithLines.length,
      lines: ordersWithLines.reduce((sum, o) => sum + o.activeLines.length, 0),
      total: basketTotal,
      sent: ordersWithLines.filter((o) => !o.needsApproval).map((o) => o.supplierName),
      awaitingApproval: ordersWithLines.filter((o) => o.needsApproval).map((o) => o.supplierName),
      deliveryDates: ordersWithLines.map((o) => o.deliveryDate).filter((d): d is string => !!d).sort(),
    };
    setSent(summary);
    setStep('sent');
  }, [ordersWithLines, basketTotal]);

  const startAgain = useCallback(() => {
    setStep('basket');
    setMode('predictive');
    setQuantities(startQuantities);
    setRemoved(startRemoved);
    setStopped(new Set());
    setReasons({});
    setAddedLines({});
    setBuiltOrders([]);
    setDates({});
    setNotes({});
    setSent(null);
  }, [startQuantities, startRemoved]);

  return {
    fixtures,
    step,
    setStep,
    mode,
    switchMode,
    quantities,
    removed,
    stopped,
    reasons,
    visibleOrders,
    ordersWithLines,
    basketTotal,
    predictiveCount,
    notes,
    sent,
    toast,
    setQuantity,
    removeLine,
    undoRemove,
    stopSuggesting,
    setLineReasons,
    inBasket,
    addProduct,
    clearBasket,
    setDeliveryDate,
    setNote,
    placeOrders,
    startAgain,
  };
}

export type BasketState = ReturnType<typeof useBasket>;

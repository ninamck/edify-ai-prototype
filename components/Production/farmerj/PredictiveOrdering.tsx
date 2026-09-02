'use client';

import { useMemo } from 'react';
import { useActiveSite } from '@/components/ActiveSite/ActiveSiteContext';
import ConfirmationScreen from '@/app/assisted-ordering/components/ConfirmationScreen';
import NotificationPanel from '@/app/assisted-ordering/components/NotificationPanel';
import OrderReview from '@/app/assisted-ordering/components/OrderReview';
import { useAssistedOrdering } from '@/app/assisted-ordering/hooks/useAssistedOrdering';
import type { RecurringOrder, SuggestedOrder } from '@/app/assisted-ordering/types';
import { Notice } from './DayPlan';
import { useFjPlanStore } from './FjPlanStore';
import { applySuggestedPars, computeFarmerJOrders, farmerJForecastCards, FJ_ORDER_SUPPLIERS, FJ_ORDERING_DATASET } from './predictiveOrders';
import { FJ_ALL_SHOPS_ID } from './shops';

/**
 * Farmer J's orders in the Predictive ordering area. Same three screens as
 * every other brand (notifications, review, confirmation) and the same
 * hook; only the data is Farmer J's, built from the shop's day plans.
 */

const NO_RECURRING: RecurringOrder[] = [];

export default function FarmerJPredictiveOrdering() {
  const { productionSiteId } = useActiveSite();
  const store = useFjPlanStore();
  const shopId = productionSiteId ?? FJ_ALL_SHOPS_ID;
  const orders = useMemo(() => {
    if (shopId === FJ_ALL_SHOPS_ID) return [];
    const o = computeFarmerJOrders(shopId, store.get);
    applySuggestedPars(o);
    return o;
  }, [shopId, store]);
  const cards = useMemo(() => (shopId === FJ_ALL_SHOPS_ID ? [] : farmerJForecastCards(shopId, store.get)), [shopId, store]);

  if (shopId === FJ_ALL_SHOPS_ID) return <Notice>Pick a shop in the site switcher to see its orders.</Notice>;

  // Quantities live in the hook's state keyed by line id and start from the
  // suggestion, so when the plan changes the screen restarts from the new
  // suggestions rather than carrying stale edits.
  const key = orders.map(o => o.lines.map(l => `${l.id}:${l.suggestedQty}`).join(',')).join('|');
  return <Screens key={key} orders={orders} cards={cards} />;
}

function Screens({ orders, cards }: { orders: SuggestedOrder[]; cards: ReturnType<typeof farmerJForecastCards> }) {
  const state = useAssistedOrdering(orders, NO_RECURRING, FJ_ORDER_SUPPLIERS);
  const {
    view, setView, groupBy, setGroupBy, showDetail, setShowDetail, quantities, setQty, removed, removeItem, restoreItem,
    setDismissReason, grandTotal, totalItems, editedCount, removedCount, supplierTotals, supplierItemCounts, confirmAll,
    manualLines, addManualLine, removeManualLine, setManualLineQty, recurringQtys, recurringActions, setRecurringQty,
    acceptRecurringLine, revertRecurringLine,
  } = state;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-surface)', overflow: 'hidden' }}>
      {view === 'notifications' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <NotificationPanel
            orders={orders}
            recurringOrders={NO_RECURRING}
            grandTotal={grandTotal}
            totalItems={totalItems}
            supplierTotals={supplierTotals}
            supplierItemCounts={supplierItemCounts}
            onReviewAll={() => setView('review')}
          />
        </div>
      )}
      {view === 'review' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <OrderReview
            orders={orders}
            quantities={quantities}
            removed={removed}
            groupBy={groupBy}
            showDetail={showDetail}
            grandTotal={grandTotal}
            totalItems={totalItems}
            editedCount={editedCount}
            removedCount={removedCount}
            supplierTotals={supplierTotals}
            supplierItemCounts={supplierItemCounts}
            onGroupByChange={setGroupBy}
            onDetailToggle={setShowDetail}
            onQtyChange={setQty}
            onRemove={removeItem}
            onRestore={restoreItem}
            onDismissReason={setDismissReason}
            onConfirmAll={confirmAll}
            onBack={() => setView('notifications')}
            manualLines={manualLines}
            onAddItem={addManualLine}
            onRemoveManualLine={removeManualLine}
            onManualLineQtyChange={setManualLineQty}
            recurringOrders={NO_RECURRING}
            recurringQtys={recurringQtys}
            recurringActions={recurringActions}
            onRecurringQtyChange={setRecurringQty}
            onRecurringAccept={acceptRecurringLine}
            onRecurringRevert={revertRecurringLine}
            forecastCards={cards}
            intro={null}
            catalogue={FJ_ORDERING_DATASET}
          />
        </div>
      )}
      {view === 'confirmed' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConfirmationScreen
            orders={orders}
            recurringOrders={NO_RECURRING}
            recurringQtys={recurringQtys}
            recurringActions={recurringActions}
            grandTotal={grandTotal}
            totalItems={totalItems}
            supplierTotals={supplierTotals}
            supplierItemCounts={supplierItemCounts}
            removed={removed}
            onDone={() => setView('notifications')}
          />
        </div>
      )}
    </div>
  );
}

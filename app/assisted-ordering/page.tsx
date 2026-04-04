'use client';

import { useAssistedOrdering } from './hooks/useAssistedOrdering';
import { SUGGESTED_ORDERS } from './data/mockOrders';
import NotificationPanel from './components/NotificationPanel';
import OrderReview from './components/OrderReview';
import ConfirmationScreen from './components/ConfirmationScreen';

export default function AssistedOrderingPage() {
  const state = useAssistedOrdering();

  const {
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
    grandTotal,
    totalItems,
    editedCount,
    removedCount,
    supplierTotals,
    supplierItemCounts,
    confirmAll,
  } = state;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-surface)',
        overflow: 'hidden',
      }}
    >
      {view === 'notifications' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <NotificationPanel
            orders={SUGGESTED_ORDERS}
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
            orders={SUGGESTED_ORDERS}
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
          />
        </div>
      )}

      {view === 'confirmed' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConfirmationScreen
            orders={SUGGESTED_ORDERS}
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

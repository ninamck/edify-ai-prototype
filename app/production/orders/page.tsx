'use client';

// /production/orders — Burger King's live "what's selling" screen.
//
// Orders arriving across the two channels the floor separates (Deliveries vs
// In-store), each fulfilled from the Pan Holding Unit oldest-first, with a
// freshness reading per order and a freshness headline for the service.

import OrderFeedScreen from '@/components/Production/OrderFeedScreen';

export default function ProductionOrdersPage() {
  return <OrderFeedScreen />;
}

'use client';

// /production/order-sheet — Farmer J order sheet for a planning window.
// What to make (sub-recipes as single lines, per day) and what to order
// (ingredients in supplier packs, less what is in the store room).

import OrderSheet from '@/components/Production/farmerj/OrderSheet';

export default function FjOrderSheetPage() {
  return <OrderSheet />;
}

'use client';

// /production/shops — Jana's cross-shop board. Every shop's plan status,
// yield drift and waste for the day, with drill-in to coach live.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjShopsPage() {
  return (
    <FjPlaceholder
      title="Shops"
      purpose="Jana's view across all 19 shops: who has approved today's plan, who is running ahead or behind forecast, where yield is drifting and where waste is climbing. Click a shop to open its day plan remotely and coach."
      step={6}
    />
  );
}

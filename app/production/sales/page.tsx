'use client';

import ProductionPlaceholder from '@/components/Production/ProductionPlaceholder';
import {
  useSalesActuals,
  useSpokes,
  useProducts,
} from '@/components/Production/productionStore';

export default function SalesFeedbackPage() {
  const sales = useSalesActuals();
  const spokes = useSpokes();
  const products = useProducts();

  return (
    <ProductionPlaceholder
      slice="Slice 4"
      title="Sales Feedback"
      description="The loop-closer. Log sales at the spoke — tomorrow's forecast shifts. This is the screen that proves the demand pipeline reacts to reality."
      dataCounts={[
        { label: 'Spokes logging sales', count: spokes.length },
        { label: 'Tickable products', count: products.length },
        { label: 'Sales recorded so far', count: sales.length },
      ]}
      comingUp={[
        'Simple +1 per product per spoke (mocked POS tick).',
        'Each tick writes to salesActuals and recomputes forecastForDate(tomorrow).',
        'Demand Dashboard for tomorrow shows a visible delta chip.',
      ]}
    />
  );
}

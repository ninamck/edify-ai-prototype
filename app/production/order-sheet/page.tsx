'use client';

// /production/order-sheet — Farmer J order sheet. Ingredient totals from
// the approved plan after overrides, in supplier pack sizes. Sub-recipes
// stay as sub-recipes (overnight oats batch, not oats plus almond milk).

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjOrderSheetPage() {
  return (
    <FjPlaceholder
      title="Order sheet"
      purpose="Ingredients the approved plan needs, rolled up in supplier pack sizes after the manager's overrides. If the tool suggested 11 bags of parsley and the manager typed 13, this says 13."
      step={5}
    />
  );
}

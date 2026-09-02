'use client';

// /production/close — Farmer J end of day. Fridge count of cooked
// components that survive to tomorrow, waste by reason, and the yield log.
// Carryover reduces tomorrow's plan.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjClosePage() {
  return (
    <FjPlaceholder
      title="Close"
      purpose="The closing manager counts what is left in the fridge. Cooked items that survive to tomorrow come off tomorrow's plan; what is binned is logged by reason. Actual weights against expected feed the yield log Jana reviews."
      step={5}
    />
  );
}

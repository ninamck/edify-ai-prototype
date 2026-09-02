'use client';

// /production/close — Farmer J end of day. Fridge count of cooked
// components that survive to tomorrow, in the line's containers, with
// waste by reason. The count comes off tomorrow's main line.

import CloseCount from '@/components/Production/farmerj/CloseCount';

export default function FjClosePage() {
  return <CloseCount />;
}

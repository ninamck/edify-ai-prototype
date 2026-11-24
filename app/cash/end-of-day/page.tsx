'use client';

import { Suspense } from 'react';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import DunkinClose from '@/components/Pret/cash/DunkinClose';
import { NoShop, OperatorOnly } from '@/components/Pret/cash/CashUi';
import { useDunkinCash } from '@/components/Pret/cashOperators';

/** Kyle's close: paid outs, the count, then the bank slip. */
export default function EndOfDayPage() {
  const { shop } = useCashShop();
  const dunkin = useDunkinCash();
  if (!dunkin) return <OperatorOnly setUp="Dunkin (Kyle)" />;
  if (!shop) return <NoShop />;
  return (
    <Suspense>
      <DunkinClose />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import DayPlan from '@/components/Production/farmerj/DayPlan';

export default function FjDayPlanPage() {
  return (
    <Suspense fallback={null}>
      <DayPlan />
    </Suspense>
  );
}

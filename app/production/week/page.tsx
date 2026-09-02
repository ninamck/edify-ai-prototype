'use client';

// /production/week — Farmer J week plan. Monday afternoon sets Wednesday to
// Sunday, Friday sets Monday to Wednesday. Reference days, catering
// columns, whole-day percentage flex, production-day pins.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjWeekPlanPage() {
  return (
    <FjPlaceholder
      title="Week plan"
      purpose="The twice-weekly planning session. Pick reference days (excluding anomalies), see catering orders as their own columns so a cancellation is one deletion, flex a whole day up or down by a percentage, and approve. Every day plan derives from here."
      step={2}
    />
  );
}

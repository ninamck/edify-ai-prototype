'use client';

// /production/day — Farmer J day plan. Finished products first: suggested
// cast irons and batches per dish, split main line vs second make line,
// catering visible, every number overridable.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjDayPlanPage() {
  return (
    <FjPlaceholder
      title="Day plan"
      purpose="The kitchen lead's first screen at 7am. Every sellable dish with Edify's suggested cast irons and batches for today, split between the main line and the second make line, catering orders on their own rows, and an override on every number."
      step={2}
    />
  );
}

'use client';

// /production/prep-list — Farmer J derived prep. Everything the day plan
// cascades to, grouped by shelf-life colour with make-on day and days
// covered. Raw weights include yield loss.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjPrepListPage() {
  return (
    <FjPlaceholder
      title="Prep list"
      purpose="What the day plan cascades to: kits, cooked components, dressings and preps, grouped by shelf-life colour. Each row shows the raw weight including yield loss, which day it is made on and how many days it covers. Parsley appears once even though four dishes use it."
      step={3}
    />
  );
}

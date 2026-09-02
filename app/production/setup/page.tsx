'use client';

// /production/setup — central setup Jana owns. Yield percentage, shelf
// life, production days with per-shop overrides, portion-to-batch mapping,
// containers. Set once, every shop updates.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjSetupPage() {
  return (
    <FjPlaceholder
      title="Setup"
      purpose="The rules that used to live in Jana's spreadsheet and her head: yield loss per recipe as an editable percentage, shelf life and production days with per-shop overrides, the till-code gramme weights that map portions to batches, and container sizes. Change it once here and every shop's plan updates."
      step={6}
    />
  );
}

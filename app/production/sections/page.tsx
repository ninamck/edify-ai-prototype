'use client';

// /production/sections — Farmer J section view. One column per person on
// shift with AM and PM tasks, how-to cards, and intraday prompts driven by
// 15-minute sales pace.

import FjPlaceholder from '@/components/Production/farmerj/FjPlaceholder';

export default function FjSectionsPage() {
  return (
    <FjPlaceholder
      title="Sections"
      purpose="One column per person on shift, named by the shop. AM tasks from the prep list, PM tasks from the day plan, a how-to card behind every task, and timing prompts such as 'start rice batch 3 now' when lunch runs ahead of forecast."
      step={4}
    />
  );
}

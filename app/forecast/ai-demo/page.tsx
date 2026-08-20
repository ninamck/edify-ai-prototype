'use client';

// /forecast/ai-demo — the headline AI forecast demonstration.
//
// Runs one Burger King lunch service two ways against identical demand —
// Edify's AI forecast vs a flat "fixed par" — and scores the difference in
// waste avoided and sales rescued, live and in $. This is the main forecast
// demo surface; the detailed per-SKU forecast tooling lives on /forecast.

import AiForecastImpact from '@/components/Forecast/AiForecastImpact';

export default function AiForecastDemoPage() {
  return <AiForecastImpact />;
}

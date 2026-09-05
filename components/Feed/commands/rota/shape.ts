/**
 * Forecast shapes the rota engine reads from data the prototype already
 * holds: the dashboard's hourly trading curve and the production
 * forecast's day-of-week pattern. Kept separate from `sources.ts` so the
 * per-site data files can import them without a cycle.
 */

import { HOURLY_TRADING } from '@/components/Dashboard/data/managerMockData';
import { DOW_MULTIPLIER } from '@/components/Production/fixtures';
import type { DayKey } from './types';

/** Relative sales weight per hour of day, from the dashboard's hourly
 *  trading forecast, so the rota reads the same shape the GM sees. */
export function hourShapeFromTrading(): Record<number, number> {
  const out: Record<number, number> = {};
  for (const row of HOURLY_TRADING) {
    const h = parseHourLabel(row.hour);
    if (h !== null) out[h] = row.forecast;
  }
  // The trading data stops at 9pm. Late evening tails off.
  out[22] = Math.round((out[21] ?? 90) * 0.6);
  return out;
}

function parseHourLabel(label: string): number | null {
  const m = label.match(/^(\d{1,2})(am|pm)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[2].toLowerCase() === 'pm') h += 12;
  return h;
}

/** Day-of-week pattern shared with the production forecast. */
export function dayMultiplierFromForecast(): Record<DayKey, number> {
  return { ...DOW_MULTIPLIER } as Record<DayKey, number>;
}

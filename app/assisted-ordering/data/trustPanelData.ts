import type { Ingredient, SuggestedOrderLine, RecurringOrderLine, TrustPanelData } from '../types';

// ─── Hero stories (verbatim from Ed's call) ───────────────────────────────────

const TRUST_PANEL_OVERRIDES: Record<string, TrustPanelData> = {
  // Recommendation matches the usual pattern — the comforting case
  'line-chicken': {
    history: {
      dayOfWeek: 'Thursdays',
      points: [
        { date: '2 May', qty: 11 },
        { date: '9 May', qty: 12 },
        { date: '16 May', qty: 13 },
        { date: '23 May', qty: 12 },
      ],
      unit: 'kg',
      average: 12,
    },
    consumption: {
      value: 15,
      unit: 'kg',
      window: 'over the next 2 days, until Saturday delivery',
      driver: 'based on forecast × recipe usage',
    },
  },

  // Recommendation higher than usual — forecast spike
  'line-oatmilk': {
    history: {
      dayOfWeek: 'Thursdays',
      points: [
        { date: '2 May', qty: 8 },
        { date: '9 May', qty: 7 },
        { date: '16 May', qty: 9 },
        { date: '23 May', qty: 8 },
      ],
      unit: 'L',
      average: 8,
    },
    consumption: {
      value: 14,
      unit: 'L',
      window: 'over the next 3 days, until Monday delivery',
      driver: 'based on forecast × recipe usage',
    },
  },

  // Recommendation lower than usual — softer weekend
  'rec-croissants': {
    history: {
      dayOfWeek: 'Fridays',
      points: [
        { date: '2 May', qty: 5 },
        { date: '9 May', qty: 5 },
        { date: '16 May', qty: 6 },
        { date: '23 May', qty: 4 },
      ],
      unit: 'boxes',
      average: 5,
    },
    consumption: {
      value: 4,
      unit: 'boxes',
      window: 'tomorrow, daily delivery',
      driver: 'based on forecast × recipe usage',
    },
  },
};

// ─── Fallback derivation for non-hero lines ───────────────────────────────────

const FALLBACK_DATES = ['2 May', '9 May', '16 May', '23 May'] as const;

function roundForUnit(value: number, unit: string): number {
  // Whole numbers for discrete units, one decimal for weight/volume.
  if (unit === 'kg' || unit === 'L') {
    return Math.max(0, Math.round(value * 10) / 10);
  }
  return Math.max(0, Math.round(value));
}

function deriveHistory(line: { suggestedQty: number }, ingredient: Ingredient) {
  const base = line.suggestedQty > 0 ? line.suggestedQty : (ingredient.parLevel ?? 1) / 3;
  // Gentle jitter around the recommended qty so the four numbers feel real.
  const offsets = [-1, 0, 1, 0];
  const points = FALLBACK_DATES.map((date, i) => ({
    date,
    qty: roundForUnit(base + offsets[i] * (base > 4 ? 1 : 0.5), ingredient.stockUnit),
  }));
  const avg = roundForUnit(
    points.reduce((sum, p) => sum + p.qty, 0) / points.length,
    ingredient.stockUnit,
  );
  return { points, average: avg };
}

function deriveConsumption(
  line: { suggestedQty: number; salesVelocity7d: number | null },
  ingredient: Ingredient,
) {
  const days = 2;
  const dailyUse = line.salesVelocity7d ?? line.suggestedQty / 3;
  return {
    value: roundForUnit(dailyUse * days, ingredient.stockUnit),
    unit: ingredient.stockUnit,
    window: 'over the next 2 days, until next delivery',
    driver: 'based on forecast × recipe usage',
  };
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function getTrustPanelDataForLine(
  line: SuggestedOrderLine,
  ingredient: Ingredient,
): TrustPanelData {
  const override = TRUST_PANEL_OVERRIDES[line.id];
  if (override) return override;

  const { points, average } = deriveHistory(line, ingredient);
  return {
    history: {
      dayOfWeek: 'Thursdays',
      points,
      unit: ingredient.stockUnit,
      average,
    },
    consumption: deriveConsumption(line, ingredient),
  };
}

export function getTrustPanelDataForRecurring(
  line: RecurringOrderLine,
  ingredient: Ingredient,
): TrustPanelData {
  const override = TRUST_PANEL_OVERRIDES[line.id];
  if (override) return override;

  const proxy = { suggestedQty: line.suggestedQty, salesVelocity7d: line.salesVelocity7d };
  const { points, average } = deriveHistory(proxy, ingredient);
  return {
    history: {
      dayOfWeek: 'Thursdays',
      points,
      unit: ingredient.stockUnit,
      average,
    },
    consumption: deriveConsumption(proxy, ingredient),
  };
}

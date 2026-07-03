import type { Ingredient, SuggestedOrderLine, RecurringOrderLine, TrustPanelData } from '../types';

// ─── Hero stories (verbatim from Ed's call) ───────────────────────────────────

const TRUST_PANEL_OVERRIDES: Record<string, TrustPanelData> = {
  // Recommendation matches the usual pattern — the comforting case.
  // Jasmine green is the everyday staple: steady week on week.
  'line-jasmine': {
    history: {
      dayOfWeek: 'Fridays',
      points: [
        { date: '4 Apr', qty: 3.0 },
        { date: '11 Apr', qty: 3.2 },
        { date: '18 Apr', qty: 3.1 },
        { date: '23 Apr', qty: 3.0 },
      ],
      unit: 'kg',
      average: 3.1,
    },
    consumption: {
      value: 3.2,
      unit: 'kg',
      window: 'over the next 2 days, until Friday delivery',
      driver: 'based on forecast × recipe usage',
    },
  },

  // Recommendation higher than usual — oat-milk lattes trending up.
  'line-oatmilk': {
    history: {
      dayOfWeek: 'Fridays',
      points: [
        { date: '4 Apr', qty: 8 },
        { date: '11 Apr', qty: 9 },
        { date: '18 Apr', qty: 11 },
        { date: '23 Apr', qty: 13 },
      ],
      unit: 'L',
      average: 10,
    },
    consumption: {
      value: 15,
      unit: 'L',
      window: 'over the next 2 days, until Friday delivery',
      driver: 'oat-milk drinks up ~40% this fortnight',
    },
  },

  // Recommendation lower than usual — straws over-ordered on the standing order.
  'rec-straws': {
    history: {
      dayOfWeek: 'This week',
      points: [
        { date: '4 Apr', qty: 5 },
        { date: '11 Apr', qty: 5 },
        { date: '18 Apr', qty: 6 },
        { date: '23 Apr', qty: 5 },
      ],
      unit: 'packs',
      average: 5,
    },
    consumption: {
      value: 5,
      unit: 'packs',
      window: 'this week, weekly delivery',
      driver: 'based on forecast × drinks mix',
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

import type { ChangeRecord } from '@/components/Feed/taskHistoryStore';
import type { ProductionField } from '@/components/Feed/commands/parsers';

/**
 * Diff for the production-setting command.
 *
 * Production fields are scalars (numbers or booleans), so each command
 * touches exactly one path. The differ doesn't need the recipe — the
 * confirm function gives us the previous value directly via `final`.
 */
const FIELD_LABELS: Record<ProductionField, string> = {
  batchMin: 'Batch min',
  batchMax: 'Batch size',
  shelfLife: 'Shelf life',
  prepTime: 'Prep time',
  carryOver: 'Carry-over',
  closingCutoff: 'Closing cutoff',
};

const FIELD_PATHS: Record<ProductionField, string> = {
  batchMin: 'formExtras.productionExtras.minBatch',
  batchMax: 'formExtras.productionExtras.maxBatch',
  shelfLife: 'production.shelfLifeMinutes',
  prepTime: 'production.prepTimeSeconds',
  carryOver: 'formExtras.advanced.allowCarryOver',
  closingCutoff: 'formExtras.advanced.closingRange',
};

const FIELD_UNITS: Partial<Record<ProductionField, string>> = {
  batchMin: '',
  batchMax: '',
  shelfLife: 'min',
  prepTime: 'min',
  closingCutoff: 'min',
};

export function diffProduction(args: {
  final: {
    recipeId: string;
    recipeName: string;
    field: ProductionField;
    value?: number;
    boolValue?: boolean;
    previousValue: number | boolean | null;
  };
}): ChangeRecord[] {
  const { final } = args;
  const before = final.previousValue;
  const after = final.boolValue ?? final.value ?? null;
  const isBool = final.boolValue !== undefined;
  return [
    {
      entityType: 'production-setting',
      entityId: final.recipeId,
      entityLabel: final.recipeName,
      fieldPath: FIELD_PATHS[final.field],
      fieldLabel: FIELD_LABELS[final.field],
      before,
      after,
      unit: isBool ? undefined : FIELD_UNITS[final.field],
      valueKind: isBool ? 'boolean' : 'number',
    },
  ];
}

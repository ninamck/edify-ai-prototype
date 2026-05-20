'use client';

import { useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { findRecipe, useRecipes } from '@/components/Recipe/recipeStore';
import CardShell, { FieldRow, PillRow, type CardState } from './CardShell';
import type { ProductionArgs, ProductionField } from '../parsers';

interface ProductionFieldCardProps {
  initialArgs: ProductionArgs;
  state: CardState;
  onConfirm: (final: {
    recipeId: string;
    recipeName: string;
    field: ProductionField;
    value?: number;
    boolValue?: boolean;
    previousValue: number | boolean | null;
  }) => void;
  onCancel: () => void;
}

const FIELD_LABELS: Record<ProductionField, string> = {
  batchMin: 'Batch minimum',
  batchMax: 'Batch size (max)',
  shelfLife: 'Shelf life',
  prepTime: 'Prep time',
  carryOver: 'Carry-over',
  closingCutoff: 'Closing cutoff',
};

const SHELF_LIFE_OPTIONS = [
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 240, label: '4h' },
  { value: 480, label: '8h' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
];

const PREP_TIME_OPTIONS = [
  { value: 60, label: '1 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 1200, label: '20 min' },
];

const CLOSING_OPTIONS = [
  { value: 0, label: 'No cutoff' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1h before' },
  { value: 120, label: '2h before' },
];

export default function ProductionFieldCard({ initialArgs, state, onConfirm, onCancel }: ProductionFieldCardProps) {
  useRecipes();
  const recipe = useMemo(
    () => (initialArgs.recipeId ? findRecipe(initialArgs.recipeId) : undefined),
    [initialArgs.recipeId],
  );

  const [field, setField] = useState<ProductionField>(initialArgs.field ?? 'shelfLife');
  const [value, setValue] = useState<number | undefined>(initialArgs.value);
  const [boolValue, setBoolValue] = useState<boolean | undefined>(initialArgs.boolValue);

  const previousValue = useMemo<number | boolean | null>(() => {
    if (!recipe) return null;
    if (field === 'shelfLife') return recipe.production.shelfLifeMinutes;
    if (field === 'prepTime') return recipe.production.prepTimeSeconds !== null ? Math.round(recipe.production.prepTimeSeconds / 60) : null;
    if (field === 'carryOver') return recipe.formExtras?.advanced?.allowCarryOver ?? false;
    if (field === 'batchMin') {
      const v = recipe.formExtras?.productionExtras?.minBatch;
      return typeof v === 'number' ? v : null;
    }
    if (field === 'batchMax') {
      const v = recipe.formExtras?.productionExtras?.maxBatch;
      return typeof v === 'number' ? v : null;
    }
    return null;
  }, [recipe, field]);

  const previousDisplay = useMemo(() => {
    if (previousValue === null || previousValue === undefined) return '—';
    if (typeof previousValue === 'boolean') return previousValue ? 'Allowed' : 'Not allowed';
    if (field === 'shelfLife') {
      if (previousValue >= 60) return `${(previousValue / 60).toFixed(previousValue % 60 ? 1 : 0)}h`;
      return `${previousValue} min`;
    }
    if (field === 'prepTime') return `${previousValue} min`;
    if (field === 'closingCutoff') return previousValue === 0 ? 'No cutoff' : `${previousValue} min before`;
    return String(previousValue);
  }, [previousValue, field]);

  const canConfirm = !!recipe && (value !== undefined || boolValue !== undefined);

  // Detect a "conflict" — for the prototype we just warn if shelf life
  // is being shortened drastically vs the previous value.
  const warning = useMemo(() => {
    if (field === 'shelfLife' && typeof previousValue === 'number' && value !== undefined && value < previousValue / 2) {
      return 'Heads up — this is much shorter than the current shelf life. Existing batches may need to be cleared sooner.';
    }
    return undefined;
  }, [field, previousValue, value]);

  return (
    <CardShell
      icon={Settings2}
      title={`Production setting — ${recipe?.name ?? initialArgs.recipeName ?? '…'}`}
      subtitle={recipe ? `Update ${FIELD_LABELS[field].toLowerCase()}` : 'Pick a recipe'}
      state={state}
      confirmLabel="Save setting"
      confirmDisabled={!canConfirm}
      warning={warning}
      onConfirm={
        recipe
          ? () =>
              onConfirm({
                recipeId: recipe.id,
                recipeName: recipe.name,
                field,
                value,
                boolValue,
                previousValue,
              })
          : undefined
      }
      onCancel={onCancel}
    >
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Field
        </div>
        <PillRow
          options={(Object.keys(FIELD_LABELS) as ProductionField[]).map((f) => ({ value: f, label: FIELD_LABELS[f] }))}
          selected={field}
          onSelect={(f) => {
            setField(f as ProductionField);
            setValue(undefined);
            setBoolValue(undefined);
          }}
          disabled={state !== 'pending'}
          small
        />
      </div>

      <FieldRow label="Current">{previousDisplay}</FieldRow>

      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          New value
        </div>
        {field === 'shelfLife' && (
          <PillRow options={SHELF_LIFE_OPTIONS} selected={value} onSelect={setValue} disabled={state !== 'pending'} />
        )}
        {field === 'prepTime' && (
          <PillRow options={PREP_TIME_OPTIONS} selected={value} onSelect={setValue} disabled={state !== 'pending'} />
        )}
        {field === 'closingCutoff' && (
          <PillRow options={CLOSING_OPTIONS} selected={value} onSelect={setValue} disabled={state !== 'pending'} />
        )}
        {field === 'carryOver' && (
          <PillRow
            options={[
              { value: 'on', label: 'Allow' },
              { value: 'off', label: 'Block' },
            ]}
            selected={boolValue === undefined ? undefined : boolValue ? 'on' : 'off'}
            onSelect={(v) => setBoolValue(v === 'on')}
            disabled={state !== 'pending'}
            small
          />
        )}
        {(field === 'batchMin' || field === 'batchMax') && (
          <input
            type="number"
            value={value ?? ''}
            disabled={state !== 'pending'}
            onChange={(e) => setValue(e.target.value === '' ? undefined : Number(e.target.value))}
            placeholder={field === 'batchMin' ? 'Minimum batch' : 'Maximum batch'}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              width: '120px',
            }}
          />
        )}
      </div>
    </CardShell>
  );
}

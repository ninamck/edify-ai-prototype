'use client';

import { useMemo } from 'react';
import { Soup } from 'lucide-react';
import { findRecipe } from '@/components/Recipe/recipeStore';
import CardShell, { type CardState } from './CardShell';
import type { RecipeEditKind } from '../parsers';

interface RecipeIngredientPickerCardProps {
  recipeId: string;
  recipeName: string;
  action: RecipeEditKind; // 'swap' | 'remove'
  state: CardState;
  onPick: (ingredientName: string) => void;
  onCancel: () => void;
}

/**
 * Step 3 of the Update-recipe wizard, shown when the operator picked
 * Swap or Remove. We list the recipe's current ingredients (legacy
 * free-text array — every fixture has it) so they can tap one rather
 * than re-typing the name.
 */
export default function RecipeIngredientPickerCard({
  recipeId,
  recipeName,
  action,
  state,
  onPick,
  onCancel,
}: RecipeIngredientPickerCardProps) {
  const recipe = findRecipe(recipeId);
  const ingredients = useMemo(() => {
    if (!recipe) return [];
    return (recipe.ingredients ?? []).filter((i) => i.name.trim().length > 0);
  }, [recipe]);

  const verb = action === 'swap' ? 'swap' : 'remove';

  if (!recipe) {
    return (
      <CardShell icon={Soup} title="Recipe not found" subtitle={recipeName} state={state} onCancel={onCancel}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          The recipe couldn&apos;t be loaded. Cancel and try again.
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell
      icon={Soup}
      title={`Which ingredient do you want to ${verb}?`}
      subtitle={recipeName}
      state={state}
      onCancel={onCancel}
    >
      {ingredients.length === 0 ? (
        <div
          style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(0,28,53,0.04)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          This recipe doesn&apos;t have any ingredients yet. Cancel and add one first.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '8px',
          }}
        >
          {ingredients.map((ing, i) => (
            <button
              key={`${ing.name}-${i}`}
              type="button"
              disabled={state !== 'pending'}
              onClick={() => onPick(ing.name)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                background: '#fff',
                cursor: state === 'pending' ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                fontFamily: 'var(--font-primary)',
              }}
              onMouseEnter={(e) => {
                if (state !== 'pending') return;
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--color-accent-active, #001C35)';
                el.style.background = 'rgba(40,175,201,0.04)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--color-border, rgba(0,28,53,0.18))';
                el.style.background = '#fff';
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{ing.name}</span>
              {(ing.qty || ing.supplier) && (
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  {[ing.qty, ing.supplier].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </CardShell>
  );
}

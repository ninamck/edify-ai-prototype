'use client';

/**
 * Recipe editor header chip. When publishing to Square is on, shows
 * whether the recipe is on the till and links to its Square menu row.
 * A sellable recipe that isn't on the till gets "Sell this at the till".
 * Renders nothing for non-Square customers.
 */

import { useRouter } from 'next/navigation';
import { Plus, Store } from 'lucide-react';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import { addRecipeToTill, tillItemForRecipe, useSquareMenu } from './squareMenuStore';
import { STATUS_LABEL, statusOf } from './tillItems';

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '3px 9px', borderRadius: 100,
  border: '1px solid var(--color-border-subtle)', background: '#fff',
  color: 'var(--color-text-secondary)',
  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

export function TillStatusChip({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const sm = useSquareMenu();
  if (!sm.settings.enabled || sm.stage !== 'done') return null;

  const item = tillItemForRecipe(recipe.id, sm.items);
  if (item) {
    const status = statusOf(item);
    return (
      <button
        type="button"
        style={chip}
        onClick={() => router.push(`/square-menu?item=${item.id}`)}
        title="Open this item on the Square menu"
      >
        <Store size={12} aria-hidden /> On the till · {STATUS_LABEL[status]}
      </button>
    );
  }

  const sellable = recipe.status === 'Active' && recipe.kind !== 'component' && !recipe.isPrep;
  if (!sellable) return null;
  return (
    <button
      type="button"
      style={chip}
      onClick={() => {
        const id = addRecipeToTill(recipe);
        router.push(`/square-menu?item=${id}`);
      }}
    >
      <Plus size={12} aria-hidden /> Sell this at the till
    </button>
  );
}

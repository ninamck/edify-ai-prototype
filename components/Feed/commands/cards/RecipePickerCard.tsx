'use client';

import { useMemo, useState } from 'react';
import { ChefHat, Search } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import CardShell, { PillRow, type CardState } from './CardShell';

interface RecipePickerCardProps {
  state: CardState;
  onPick: (recipeId: string, recipeName: string) => void;
  onCancel: () => void;
}

/**
 * Step 1 of the Update-recipe wizard. A searchable, scrollable list of
 * recipes. The most common categories surface as quick-filter pills at
 * the top so the operator can scope down fast without typing.
 */
export default function RecipePickerCard({ state, onPick, onCancel }: RecipePickerCardProps) {
  const recipes = useRecipes();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) set.add(r.category);
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes
      .filter((r) => r.status !== 'Archived')
      .filter((r) => (category ? r.category === category : true))
      .filter((r) => (q ? r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) : true))
      .slice(0, 60);
  }, [recipes, query, category]);

  return (
    <CardShell
      icon={ChefHat}
      title="Update a recipe"
      subtitle="Pick the recipe you want to change"
      state={state}
      onCancel={onCancel}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          borderRadius: '10px',
          border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
          background: '#fff',
          marginBottom: '10px',
        }}
      >
        <Search size={14} color="var(--color-text-muted)" />
        <input
          type="text"
          value={query}
          disabled={state !== 'pending'}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {categories.length > 1 && (
        <div style={{ marginBottom: '10px' }}>
          <PillRow
            options={[{ value: '__all', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]}
            selected={category ?? '__all'}
            onSelect={(v) => setCategory(v === '__all' ? undefined : (v as string))}
            disabled={state !== 'pending'}
            small
          />
        </div>
      )}

      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          borderRadius: '10px',
          border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
        }}
      >
        {filtered.length === 0 && (
          <div
            style={{
              padding: '14px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              textAlign: 'center',
            }}
          >
            No recipes match — try a different search.
          </div>
        )}
        {filtered.map((r, i) => (
          <button
            key={r.id}
            type="button"
            disabled={state !== 'pending'}
            onClick={() => onPick(r.id, r.name)}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '10px 12px',
              border: 'none',
              borderBottom:
                i < filtered.length - 1 ? '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))' : 'none',
              background: 'transparent',
              cursor: state === 'pending' ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              fontFamily: 'var(--font-primary)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{r.name}</div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {r.category} · ${r.priceDineIn.toFixed(2)}
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Pick →</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

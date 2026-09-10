'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, AlertTriangle, ChevronRight } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { useModifierGroups, upsertGroup, genGroupId } from '@/components/Modifiers/store';
import { useRecipes, recipesUsingGroup } from '@/components/Recipe/recipeStore';
import type { ModifierGroup } from '@/components/Modifiers/types';

export default function ModifierGroupsPage() {
  const router = useRouter();
  const groups = useModifierGroups();
  const recipes = useRecipes(); // subscribe so usage counts re-render
  void recipes;
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(needle));
  }, [groups, q]);

  function handleAdd() {
    const id = genGroupId();
    const g: ModifierGroup = {
      id,
      name: 'New modifier group',
      selection: 'one',
      required: false,
      options: [],
    };
    upsertGroup(g);
    router.push(`/modifier-groups/${id}/edit`);
  }

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: '1120px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Toolbar row — title lives in the area top bar; the summary
          line holds the left side so the CTA stays pinned right. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, flex: 1 }}>
          Catalogue-level modifiers shared across recipes. Add an alt milk in one place — every coffee picks it up.
        </p>
        <button
          onClick={handleAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: 'var(--color-accent-active)', color: '#fff',
            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
          }}
        >
          <Plus size={15} strokeWidth={2.2} /> New modifier group
        </button>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', background: '#fff',
          border: '1px solid var(--color-border-subtle)', borderRadius: 10, marginBottom: 14,
        }}
      >
        <Search size={14} color="var(--color-text-muted)" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search modifier groups…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {filtered.map((g, i) => {
          const usedBy = recipesUsingGroup(g.id);
          const missingDefault = g.required && g.options.every((o) => !o.isDefault);
          return (
            <button
              key={g.id}
              onClick={() => router.push(`/modifier-groups/${g.id}/edit`)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: '#fff',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                padding: '14px 18px',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto 120px 20px',
                alignItems: 'center',
                columnGap: 16,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{g.name}</div>
                <div
                  style={{
                    fontSize: 12.5, color: 'var(--color-text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {g.options.length === 0
                    ? 'No options yet'
                    : g.options.map((o) => o.name || 'Untitled').join(' · ')}
                </div>
              </div>

              <span>
                {missingDefault && (
                  <StatusPill tone="warning" icon={<AlertTriangle size={10} strokeWidth={2.4} />}>
                    No default
                  </StatusPill>
                )}
              </span>

              <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {usedBy.length === 0
                  ? <span style={{ color: 'var(--color-text-muted)' }}>Not in use</span>
                  : `${usedBy.length} recipe${usedBy.length === 1 ? '' : 's'}`}
              </span>

              <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No modifier groups match.
          </div>
        )}
      </div>
    </div>
  );
}

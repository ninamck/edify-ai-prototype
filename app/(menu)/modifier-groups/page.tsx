'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ArrowRight, AlertTriangle, Lock } from 'lucide-react';
import { useModifierGroups, upsertGroup, genGroupId } from '@/components/Modifiers/store';
import { useRecipes, recipesUsingGroup } from '@/components/Recipe/recipeStore';
import type { ModifierGroup } from '@/components/Modifiers/types';

function describeOption(opt: ModifierGroup['options'][number]): string {
  if (opt.effects.length === 0) return 'No-op (default)';
  const e = opt.effects[0];
  if (e.kind === 'add') return `+ ${e.qty.value}${e.qty.unit}`;
  if (e.kind === 'replace') return 'Swap';
  if (e.kind === 'scale') return `× ${e.factor}`;
  if (e.kind === 'set-slot') return e.qty ? `Slot ${e.qty.value}${e.qty.unit}` : 'Slot';
  return '';
}

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
          Modifier groups
        </h1>
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
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 18px' }}>
        Catalogue-level modifiers shared across recipes. Add an alt milk in one place — every coffee picks it up.
      </p>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((g) => {
          const usedBy = recipesUsingGroup(g.id);
          return (
            <button
              key={g.id}
              onClick={() => router.push(`/modifier-groups/${g.id}/edit`)}
              style={{
                textAlign: 'left',
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-primary)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                rowGap: 10,
                columnGap: 16,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
                  <Pill tone={g.required ? 'navy' : 'soft'}>{g.required ? 'Required' : 'Optional'}</Pill>
                  <Pill tone="soft">{g.selection === 'one' ? 'Pick one' : 'Pick many'}</Pill>
                  {g.posSourceId && <Pill tone="soft">POS: {g.posSourceId}</Pill>}
                </div>
                {g.notes && (
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    {g.notes}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.options.map((opt) => (
                    <span
                      key={opt.id}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 100,
                        background: 'var(--color-bg-hover)',
                        color: 'var(--color-text-secondary)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {opt.isDefault && <Lock size={10} />}
                      {opt.name}
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, fontSize: 10.5 }}>
                        {describeOption(opt)}
                      </span>
                    </span>
                  ))}
                  {g.options.length === 0 && (
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      No options yet
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase', color: 'var(--color-text-muted)',
                  }}
                >
                  Used by
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {usedBy.length}
                  <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                    recipe{usedBy.length === 1 ? '' : 's'}
                  </span>
                </span>
                {usedBy.length > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'right', maxWidth: 220 }}>
                    {usedBy.slice(0, 3).map((r) => r.name).join(', ')}
                    {usedBy.length > 3 && `, +${usedBy.length - 3} more`}
                  </span>
                )}
                {g.required && g.options.every((o) => !o.isDefault) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-warning)' }}>
                    <AlertTriangle size={11} /> Required but no default
                  </span>
                )}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Edit <ArrowRight size={12} />
                </span>
              </div>
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

function Pill({ children, tone }: { children: React.ReactNode; tone: 'navy' | 'soft' }) {
  if (tone === 'navy') {
    return (
      <span
        style={{
          padding: '2px 8px', borderRadius: 100,
          background: 'rgba(0, 28, 53,0.08)', color: 'var(--color-accent-active)',
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      style={{
        padding: '2px 8px', borderRadius: 100,
        background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)',
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}

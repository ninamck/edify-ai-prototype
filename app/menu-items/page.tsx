'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import {
  useMenuItems, upsertMenuItem, genMenuItemId,
} from '@/components/MenuItems/store';
import type { MenuItem, MenuItemCategory } from '@/components/MenuItems/types';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useModifierGroups } from '@/components/Modifiers/store';

const CATEGORIES: ('All' | MenuItemCategory)[] = [
  'All', 'Coffee', 'Tea', 'Pastry', 'Food', 'Wine', 'Spirits', 'Kids',
  'Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage',
];

export default function MenuItemsPage() {
  const router = useRouter();
  const items = useMenuItems();
  const recipes = useRecipes();
  const groups = useModifierGroups();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'All' | MenuItemCategory>('All');

  const filtered = useMemo(() => {
    let list = items;
    if (cat !== 'All') list = list.filter((m) => m.category === cat);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(needle));
    }
    return list;
  }, [items, q, cat]);

  function handleAdd() {
    const id = genMenuItemId();
    const m: MenuItem = {
      id,
      name: 'New menu item',
      category: 'Coffee',
      slots: [],
      modifierGroupIds: [],
      posLinked: false,
      status: 'Draft',
    };
    upsertMenuItem(m);
    router.push(`/menu-items/${id}/edit`);
  }

  function recipeName(id: string | undefined): string {
    if (!id) return '';
    return recipes.find((r) => r.id === id)?.name ?? `(missing recipe ${id})`;
  }
  function groupName(id: string): string {
    return groups.find((g) => g.id === id)?.name ?? id;
  }

  const linkedCount = items.filter((m) => m.posLinked).length;
  const modDriven = items.filter((m) => !m.defaultRecipeId).length;

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1180, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, flex: 1 }}>
          Menu items
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
          <Plus size={15} strokeWidth={2.2} /> New menu item
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 18px' }}>
        {items.length} menu items · {linkedCount} POS-linked · {modDriven} modifier-driven (no default recipe)
      </p>

      {/* Filter + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: '6px 12px', borderRadius: 100,
                border: '1px solid ' + (cat === c ? 'transparent' : 'var(--color-border-subtle)'),
                background: cat === c ? 'var(--color-accent-active)' : '#fff',
                color: cat === c ? '#fff' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, padding: '8px 12px', background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 10 }}>
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu items…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => router.push(`/menu-items/${m.id}/edit`)}
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
              gridTemplateColumns: '1.6fr 1fr 1.4fr 90px',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 100,
                  background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
                }}>{m.category}</span>
                {m.status === 'Draft' && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(241,180,52,0.18)', color: 'var(--color-warning)',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
                  }}>Draft</span>
                )}
              </div>
              {m.notes && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{m.notes}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Default recipe
              </div>
              {m.defaultRecipeId ? (
                <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)' }}>
                  {recipeName(m.defaultRecipeId)}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Modifier-driven (no default)
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Modifier groups
              </div>
              {m.modifierGroupIds.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>None</div>
              ) : (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {m.modifierGroupIds.map((gid) => (
                    <span key={gid} style={{
                      padding: '2px 8px', borderRadius: 100,
                      background: 'rgba(3,28,89,0.07)', color: 'var(--color-accent-active)',
                      fontSize: 11, fontWeight: 600,
                    }}>{groupName(gid)}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600,
                color: m.posLinked ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
              }}>
                {m.posLinked ? <Wifi size={11} /> : <WifiOff size={11} />}
                {m.posLinked ? 'Linked' : 'Not linked'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Edit <ArrowRight size={12} />
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No menu items match.
          </div>
        )}
      </div>
    </div>
  );
}

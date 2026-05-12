'use client';

/**
 * Item matching — ongoing reconciliation of POS items ↔ Edify recipes.
 *
 * Unlike the one-time POS intake wizard (`/recipes/intake/pos`), this is
 * the day-to-day view a manager checks when:
 *   • A new POS button was added → needs an Edify recipe
 *   • A recipe was archived → its POS row goes red
 *   • Two POS items are firing the same recipe by accident
 *
 * Match is established via `Recipe.posSourceId`. Anything in the POS
 * intake fixture whose id doesn't appear as a `posSourceId` on any
 * recipe is "Unmatched" and needs action.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ExternalLink, AlertTriangle, Check, Link2 } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';

type Filter = 'all' | 'matched' | 'unmatched' | 'review';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  matched: 'Matched',
  unmatched: 'Unmatched',
  review: 'Needs review',
};

function posSourceIdFor(posItemId: string): string {
  // Convention used across the seed: `pos-${posItemId}` is what we
  // stamp on `Recipe.posSourceId` when an item is matched.
  return `pos-${posItemId}`;
}

export default function ItemMatchingPage() {
  const router = useRouter();
  const recipes = useRecipes();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const recipesByPosSourceId = useMemo(() => {
    const m = new Map<string, typeof recipes[number]>();
    for (const r of recipes) {
      if (r.posSourceId) m.set(r.posSourceId, r);
    }
    return m;
  }, [recipes]);

  const rows = useMemo(() => {
    return FITZROY_POS_INTAKE.menuItems.map((p) => {
      const recipe = recipesByPosSourceId.get(posSourceIdFor(p.id));
      const needsReview = p.matchStatus === 'one-ambiguous' || p.matchStatus === 'needs-info';
      const state: 'matched' | 'unmatched' | 'review' = !recipe
        ? 'unmatched'
        : needsReview
          ? 'review'
          : 'matched';
      return { pos: p, recipe, state };
    });
  }, [recipesByPosSourceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.state !== filter) return false;
      if (!q) return true;
      return (
        r.pos.name.toLowerCase().includes(q)
        || (r.recipe?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    matched: rows.filter((r) => r.state === 'matched').length,
    unmatched: rows.filter((r) => r.state === 'unmatched').length,
    review: rows.filter((r) => r.state === 'review').length,
  }), [rows]);

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1180, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <div style={{ marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Item matching
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          Every POS button needs to point at a recipe so sales can deplete stock and roll into the
          forecast. Unmatched buttons here fire blind. <strong style={{ color: 'var(--color-text-primary)' }}>Source:</strong> {FITZROY_POS_INTAKE.source} · last sync 2 min ago
        </p>
      </div>

      {/* Filters + search */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          marginTop: 18, marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 12px', borderRadius: 100,
                  border: active ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
                  background: active ? 'var(--color-accent-active)' : '#fff',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {FILTER_LABELS[f]}
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
                }}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: '#fff', border: '1px solid var(--color-border-subtle)',
            minWidth: 240, flex: '0 1 320px',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search POS items or recipes…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 12, overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 100px 130px 1.4fr 180px',
            gap: 12,
            padding: '11px 16px',
            background: '#FBFAF8',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--color-text-muted)',
          }}
        >
          <span>POS button</span>
          <span>Category</span>
          <span>Match</span>
          <span>Linked recipe</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Nothing here. Try a different filter or clear the search.
          </div>
        ) : (
          filtered.map((row) => (
            <Row
              key={row.pos.id}
              pos={row.pos}
              recipe={row.recipe}
              state={row.state}
              onOpenRecipe={(id) => router.push(`/recipes/${id}/edit`)}
              onMatch={() => alert(`Match "${row.pos.name}" to an existing recipe — picker coming soon.`)}
              onCreate={() => router.push(`/recipes/intake/pos`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  pos, recipe, state, onOpenRecipe, onMatch, onCreate,
}: {
  pos: typeof FITZROY_POS_INTAKE.menuItems[number];
  recipe?: ReturnType<typeof useRecipes>[number];
  state: 'matched' | 'unmatched' | 'review';
  onOpenRecipe: (id: string) => void;
  onMatch: () => void;
  onCreate: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 100px 130px 1.4fr 180px',
        gap: 12,
        padding: '12px 16px',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {pos.name}
        </div>
        {pos.note && (
          <div style={{
            fontSize: 11.5, color: 'var(--color-warning)',
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
          }}>
            <AlertTriangle size={11} /> {pos.note}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{pos.category}</span>
      <MatchPill state={state} />
      <div style={{ minWidth: 0 }}>
        {recipe ? (
          <button
            onClick={() => onOpenRecipe(recipe.id)}
            style={recipeLinkStyle}
          >
            <Link2 size={12} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipe.name}
            </span>
            <ExternalLink size={12} />
          </button>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Not linked
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {state === 'unmatched' ? (
          <>
            <button onClick={onMatch} style={secondaryBtnStyle}>Match…</button>
            <button onClick={onCreate} style={primaryBtnStyle}>Create recipe</button>
          </>
        ) : (
          <button onClick={onMatch} style={secondaryBtnStyle}>Change link</button>
        )}
      </div>
    </div>
  );
}

function MatchPill({ state }: { state: 'matched' | 'unmatched' | 'review' }) {
  if (state === 'matched') {
    return (
      <span style={{ ...pillBase, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
        <Check size={11} strokeWidth={2.5} /> Matched
      </span>
    );
  }
  if (state === 'review') {
    return (
      <span style={{ ...pillBase, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
        <AlertTriangle size={11} /> Review
      </span>
    );
  }
  return (
    <span style={{ ...pillBase, background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
      Unmatched
    </span>
  );
}

const pillBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', borderRadius: 100,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
  whiteSpace: 'nowrap', width: 'fit-content',
};

const recipeLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  width: '100%', maxWidth: 280,
  padding: '6px 10px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8,
  border: 'none', background: 'var(--color-accent-active)',
  color: '#fff', fontSize: 12, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

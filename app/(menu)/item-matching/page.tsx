'use client';

/**
 * Item matching — ongoing reconciliation of POS items ↔ Edify recipes /
 * products / master products.
 *
 * Unlike the one-time POS intake wizard (`/recipes/intake/pos`), this is
 * the day-to-day view a manager checks when:
 *   • A new POS button was added → needs a target
 *   • A recipe was archived → its POS row goes red
 *   • Two POS items are firing the same recipe by accident
 *
 * Match is established via `Recipe.posSourceId` for the default
 * POS button → recipe case, OR via the override store
 * (`components/ItemMatching/overrideStore`) when a POS button has been
 * manually pointed at a recipe / product / master product, or hidden.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ExternalLink, AlertTriangle, Check, Link2,
  Package, Boxes, Eye, EyeOff, MoreHorizontal, ChevronDown,
} from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts, useMasterProducts } from '@/components/Suppliers/store';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { FITZROY_POS_INTAKE } from '@/components/Recipe/intakeFixtures';
import {
  useMatchOverrides,
  setHidden,
  setMatchTarget,
  clearMatchTarget,
  type MatchTarget,
} from '@/components/ItemMatching/overrideStore';
import { MatchPicker } from '@/components/ItemMatching/MatchPicker';
import { SyncMatchModal } from '@/components/ItemMatching/SyncMatchModal';

type Filter = 'all' | 'matched' | 'unmatched' | 'review';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  matched: 'Matched',
  unmatched: 'Unmatched',
  review: 'Needs review',
};

type RowState = 'matched' | 'unmatched' | 'review';

type ResolvedTarget =
  | { kind: 'recipe'; id: string; name: string; href?: string }
  | { kind: 'product'; id: string; name: string; href?: string }
  | { kind: 'master-product'; id: string; name: string; href?: string };

function posSourceIdFor(posItemId: string): string {
  return `pos-${posItemId}`;
}

/** Loose normalization for name-similarity scoring — mirrors the
 *  helper inside `SyncMatchModal` so the inline-suggestion and the
 *  sync-modal stay consistent if we ever cross-reference them. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

function nameScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Token overlap (Jaccard) for fuzzier matches like "Coca-Cola" → "Atlas Cola".
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : shared / union;
}

/** Threshold for surfacing a suggestion on an unmatched Drinks row.
 *  Much looser than Sync & match's auto-apply threshold (0.8) because
 *  the operator still has to confirm here, and we want loose token
 *  overlap (e.g. "Coca-Cola" ↔ "Atlas Cola Mixer") to count. The
 *  candidate pool is already restricted to Beverage products, so the
 *  risk of a noisy suggestion is small. */
const SUGGESTION_THRESHOLD = 0.2;

export default function ItemMatchingPage() {
  const router = useRouter();
  const recipes = useRecipes();
  const products = useProducts();
  const masters = useMasterProducts();
  const overrides = useMatchOverrides();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const recipesByPosSourceId = useMemo(() => {
    const m = new Map<string, typeof recipes[number]>();
    for (const r of recipes) {
      if (r.posSourceId) m.set(r.posSourceId, r);
    }
    return m;
  }, [recipes]);

  const recipesById = useMemo(() => {
    const m = new Map<string, typeof recipes[number]>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const productsById = useMemo(() => {
    const m = new Map<string, typeof products[number]>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const mastersById = useMemo(() => {
    const m = new Map<string, typeof masters[number]>();
    for (const x of masters) m.set(x.id, x);
    return m;
  }, [masters]);

  // Beverage products are pre-filtered so we don't re-scan the
  // whole catalogue for every Drinks row. New imports (e.g. the
  // Atlas Drinks Co. supplier catalogue from the chat flow) land
  // here automatically because `useProducts()` reflects the store.
  const beverageProducts = useMemo(
    () => products.filter((p) => p.category === 'Beverage'),
    [products],
  );

  const rows = useMemo(() => {
    return FITZROY_POS_INTAKE.menuItems.map((p) => {
      const override = overrides.get(p.id);
      const hidden = override?.hidden === true;

      let target: ResolvedTarget | undefined;
      let matchTarget: MatchTarget | undefined;

      if (override?.target) {
        matchTarget = override.target;
        if (override.target.type === 'recipe') {
          const r = recipesById.get(override.target.id);
          if (r) target = { kind: 'recipe', id: r.id, name: r.name, href: `/recipes/${r.id}/edit` };
        } else if (override.target.type === 'product') {
          const pr = productsById.get(override.target.id);
          if (pr) target = { kind: 'product', id: pr.id, name: pr.name, href: `/suppliers/products/${pr.id}` };
        } else {
          const mp = mastersById.get(override.target.id);
          if (mp) target = { kind: 'master-product', id: mp.id, name: mp.name, href: `/suppliers/master-products/${mp.id}` };
        }
      } else {
        const r = recipesByPosSourceId.get(posSourceIdFor(p.id));
        if (r) {
          target = { kind: 'recipe', id: r.id, name: r.name, href: `/recipes/${r.id}/edit` };
          matchTarget = { type: 'recipe', id: r.id };
        }
      }

      const needsReview = !override?.target
        && (p.matchStatus === 'one-ambiguous' || p.matchStatus === 'needs-info');
      const state: RowState = !target
        ? 'unmatched'
        : needsReview
          ? 'review'
          : 'matched';

      // Surface a one-click suggestion for unmatched whole-drink POS
      // rows (Sparkling water, Coca-Cola, Apple Fizz, …). We scope
      // to category === 'Drinks' on the POS side and
      // category === 'Beverage' on the catalogue side so the
      // affordance only appears where the operator would expect it.
      let suggestion: ResolvedTarget | undefined;
      let suggestionMatch: MatchTarget | undefined;
      if (state === 'unmatched' && p.category === 'Drinks' && beverageProducts.length > 0) {
        let best: { id: string; name: string; s: number } | null = null;
        for (const cand of beverageProducts) {
          const s = nameScore(p.name, cand.name);
          if (s >= SUGGESTION_THRESHOLD && (!best || s > best.s)) {
            best = { id: cand.id, name: cand.name, s };
          }
        }
        if (best) {
          suggestion = {
            kind: 'product',
            id: best.id,
            name: best.name,
            href: `/suppliers/products/${best.id}`,
          };
          suggestionMatch = { type: 'product', id: best.id };
        }
      }

      return { pos: p, target, matchTarget, state, hidden, suggestion, suggestionMatch };
    });
  }, [overrides, recipesByPosSourceId, recipesById, productsById, mastersById, beverageProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.hidden && !showHidden) return false;
      if (filter !== 'all' && r.state !== filter) return false;
      if (!q) return true;
      return (
        r.pos.name.toLowerCase().includes(q)
        || (r.target?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter, showHidden]);

  const counts = useMemo(() => {
    const visible = rows.filter((r) => !r.hidden);
    return {
      all: visible.length,
      matched: visible.filter((r) => r.state === 'matched').length,
      unmatched: visible.filter((r) => r.state === 'unmatched').length,
      review: visible.filter((r) => r.state === 'review').length,
      hidden: rows.filter((r) => r.hidden).length,
    };
  }, [rows]);

  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      <div style={{
        marginBottom: 6,
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            Every POS button needs to point at a recipe, product, or master product so sales can deplete stock and roll into the
            forecast. Unmatched buttons here fire blind. <strong style={{ color: 'var(--color-text-primary)' }}>Source:</strong> {FITZROY_POS_INTAKE.source} · last sync 2 min ago
          </p>
        </div>
        <button
          onClick={() => setSyncOpen(true)}
          title="Pull fresh POS data and auto-match what we can"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10,
            border: 'none', background: 'var(--color-accent-active)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-primary)', cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 1px 0 rgba(0, 28, 53, 0.08)',
          }}
        >
          <EdifyMark size={14} />
          Sync & match
        </button>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          marginTop: 16,
        }}
      >
        <StatTile
          label="Matched"
          value={counts.matched}
          total={counts.all}
          active={filter === 'matched'}
          accent="var(--color-success, #2DA160)"
          onClick={() => setFilter(filter === 'matched' ? 'all' : 'matched')}
        />
        <StatTile
          label="Unmatched"
          value={counts.unmatched}
          total={counts.all}
          active={filter === 'unmatched'}
          accent="var(--color-text-primary)"
          onClick={() => setFilter(filter === 'unmatched' ? 'all' : 'unmatched')}
        />
        <StatTile
          label="Needs review"
          value={counts.review}
          total={counts.all}
          active={filter === 'review'}
          accent="var(--color-warning, #C7821C)"
          onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
        />
        <StatTile
          label="Hidden"
          value={counts.hidden}
          total={counts.all + counts.hidden}
          active={showHidden}
          accent="var(--color-text-muted)"
          onClick={() => setShowHidden((v) => !v)}
        />
      </div>

      {/* Filters + search */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          marginTop: 14, marginBottom: 12,
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
                  {f === 'all' ? counts.all : counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowHidden((v) => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 100,
            border: '1px solid var(--color-border-subtle)',
            background: showHidden ? 'var(--color-accent-active)' : '#fff',
            color: showHidden ? '#fff' : 'var(--color-text-secondary)',
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
          {showHidden ? 'Hiding shown' : 'Show hidden'}
          <span style={{
            fontSize: 10.5, fontWeight: 700,
            color: showHidden ? 'rgba(255,255,255,0.85)' : 'var(--color-text-muted)',
          }}>
            {counts.hidden}
          </span>
        </button>

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
            placeholder="Search POS items, recipes, products…"
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
          borderRadius: 12, overflow: 'visible',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: '#fff',
            borderTopLeftRadius: 12, borderTopRightRadius: 12,
          }}
        >
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)',
          }}>
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>·</span>
          <SummaryDot color="var(--color-success, #166534)" label={`${counts.matched} matched`} />
          <SummaryDot color="var(--color-text-primary)" label={`${counts.unmatched} unmatched`} />
          {counts.review > 0 && (
            <SummaryDot color="var(--color-warning, #EA580C)" label={`${counts.review} needs review`} />
          )}
          {counts.hidden > 0 && (
            <SummaryDot color="var(--color-text-muted)" label={`${counts.hidden} hidden`} />
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 100px 130px 1.6fr 140px',
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
          <span>Linked target</span>
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
              target={row.target}
              matchTarget={row.matchTarget}
              suggestion={row.suggestion}
              state={row.state}
              hidden={row.hidden}
              isMenuOpen={menuFor === row.pos.id}
              isPickerOpen={pickerFor === row.pos.id}
              onOpenTarget={(href) => router.push(href)}
              onMatch={() => setPickerFor(pickerFor === row.pos.id ? null : row.pos.id)}
              onApplySuggestion={() => {
                if (row.suggestionMatch) setMatchTarget(row.pos.id, row.suggestionMatch);
              }}
              onClosePicker={() => setPickerFor(null)}
              onCreate={() => router.push(`/recipes/intake/pos`)}
              onToggleMenu={() => setMenuFor(menuFor === row.pos.id ? null : row.pos.id)}
              onCloseMenu={() => setMenuFor(null)}
              onHide={() => { setHidden(row.pos.id, !row.hidden); setMenuFor(null); }}
              onClearMatch={() => { clearMatchTarget(row.pos.id); setMenuFor(null); }}
              canClearMatch={!!overrides.get(row.pos.id)?.target}
            />
          ))
        )}
      </div>

      {syncOpen && <SyncMatchModal onClose={() => setSyncOpen(false)} />}
    </div>
  );
}

function StatTile({
  label, value, total, active, accent, onClick,
}: {
  label: string;
  value: number;
  /** When set, the tile shows `value / total` as a percentage plus
   *  the "X of Y" denominator line. Falls back to just the raw number
   *  when omitted (or when `total` is 0). */
  total?: number;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  const hasRatio = total !== undefined && total > 0;
  const pct = hasRatio ? Math.round((value / (total as number)) * 100) : 0;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 12,
        border: active ? '1px solid var(--color-accent-active)' : '1px solid var(--color-border-subtle)',
        background: '#fff',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'flex', flexDirection: 'column', gap: 4,
        boxShadow: active ? '0 0 0 2px rgba(0, 28, 53, 0.08)' : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
    >
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--color-text-muted)',
      }}>
        {label}
      </span>
      {hasRatio ? (
        <>
          <span style={{
            fontSize: 30, fontWeight: 700, lineHeight: 1,
            color: accent,
            letterSpacing: '-0.02em',
          }}>
            {pct}
            <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 2 }}>%</span>
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)',
            marginTop: 2,
          }}>
            {value} of {total}
          </span>
        </>
      ) : (
        <span style={{
          fontSize: 26, fontWeight: 700, lineHeight: 1,
          color: accent,
        }}>
          {value}
        </span>
      )}
    </button>
  );
}

function Row({
  pos, target, matchTarget, suggestion, state, hidden, isMenuOpen, isPickerOpen,
  onOpenTarget, onMatch, onApplySuggestion, onClosePicker, onCreate,
  onToggleMenu, onCloseMenu, onHide, onClearMatch, canClearMatch,
}: {
  pos: typeof FITZROY_POS_INTAKE.menuItems[number];
  target?: ResolvedTarget;
  matchTarget?: MatchTarget;
  /** When set, the unmatched cell renders a one-click "Suggested"
   *  affordance instead of the bare "Match to…" placeholder. */
  suggestion?: ResolvedTarget;
  state: RowState;
  hidden: boolean;
  isMenuOpen: boolean;
  isPickerOpen: boolean;
  onOpenTarget: (href: string) => void;
  onMatch: () => void;
  onApplySuggestion?: () => void;
  onClosePicker: () => void;
  onCreate: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onHide: () => void;
  onClearMatch: () => void;
  canClearMatch: boolean;
}) {
  const targetIcon = target?.kind === 'product' ? <Package size={12} />
    : target?.kind === 'master-product' ? <Boxes size={12} />
      : <Link2 size={12} />;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 100px 130px 1.6fr 140px',
        gap: 12,
        padding: '12px 16px',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border-subtle)',
        opacity: hidden ? 0.55 : 1,
        background: hidden ? '#FBFAF8' : 'transparent',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {pos.name}
          {hidden && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: 'var(--color-text-muted)',
              padding: '1px 6px', borderRadius: 100,
              border: '1px solid var(--color-border-subtle)',
            }}>
              Hidden
            </span>
          )}
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
      <div style={{ minWidth: 0, position: 'relative' }}>
        {target ? (
          <div
            role="button"
            tabIndex={0}
            onClick={onMatch}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMatch(); } }}
            style={{
              ...recipeLinkStyle,
              ...(isPickerOpen ? { borderColor: 'var(--color-accent-active)' } : null),
            }}
            title={`${target.name} — click to change match`}
          >
            {targetIcon}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {target.name}
            </span>
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (target.href) onOpenTarget(target.href); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (target.href) onOpenTarget(target.href);
                }
              }}
              title={`Open ${target.kind === 'master-product' ? 'master product' : target.kind}`}
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', color: 'var(--color-text-muted)',
                padding: '1px 5px', borderRadius: 100,
                border: '1px solid var(--color-border-subtle)',
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              {target.kind === 'master-product' ? 'Master' : target.kind === 'product' ? 'Product' : 'Recipe'}
            </span>
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); if (target.href) onOpenTarget(target.href); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (target.href) onOpenTarget(target.href);
                }
              }}
              title="Open"
              style={{
                display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              <ExternalLink size={12} />
            </span>
            <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ) : suggestion ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onApplySuggestion?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onApplySuggestion?.();
              }
            }}
            style={{
              ...recipeLinkStyle,
              borderStyle: 'dashed',
              borderColor: 'var(--color-accent-active)',
              background: 'rgba(40, 175, 201, 0.06)',
              ...(isPickerOpen ? { borderStyle: 'solid' } : null),
            }}
            title={`Match to ${suggestion.name}`}
          >
            <EdifyMark size={12} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {suggestion.name}
            </span>
            <span
              style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-active)',
                padding: '1px 5px', borderRadius: 100,
                border: '1px solid var(--color-accent-active)',
                background: 'rgba(40, 175, 201, 0.10)',
                whiteSpace: 'nowrap',
              }}
            >
              Suggested
            </span>
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onMatch(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onMatch();
                }
              }}
              title="Pick a different match"
              style={{
                display: 'inline-flex', alignItems: 'center',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
            >
              <ChevronDown size={14} />
            </span>
          </div>
        ) : (
          <button
            onClick={onMatch}
            style={{
              ...matchDropdownStyle,
              ...(isPickerOpen ? { borderStyle: 'solid', borderColor: 'var(--color-accent-active)' } : null),
            }}
            title="Match to a recipe, product, or master product"
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Match to…
            </span>
            <ChevronDown size={14} />
          </button>
        )}
        {/* Inline dropdown anchored under the linked-target trigger.
            When the operator opens the picker on an unmatched row that
            has a pending suggestion, pre-highlight the suggestion as
            the "Current" choice so they have a reference point. */}
        {isPickerOpen && (
          <MatchPicker
            posItemId={pos.id}
            currentTarget={
              matchTarget
                ?? (suggestion ? { type: suggestion.kind, id: suggestion.id } : undefined)
            }
            onClose={onClosePicker}
            align="left"
          />
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', position: 'relative' }}>
        <button
          onClick={onToggleMenu}
          aria-label="Row actions"
          style={{
            ...secondaryBtnStyle,
            padding: '7px 8px',
          }}
        >
          <MoreHorizontal size={14} />
        </button>
        {isMenuOpen && (
          <>
            <div
              onClick={onCloseMenu}
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
            />
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#fff',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 10,
                boxShadow: '0 12px 24px -8px rgba(0, 28, 53, 0.25)',
                minWidth: 180,
                zIndex: 60,
                overflow: 'hidden',
                fontFamily: 'var(--font-primary)',
              }}
            >
              <MenuItem onClick={onHide}>
                {hidden ? 'Unhide row' : 'Hide row'}
              </MenuItem>
              {canClearMatch && (
                <MenuItem onClick={onClearMatch}>
                  Clear match
                </MenuItem>
              )}
              <MenuItem onClick={() => { onCreate(); onCloseMenu(); }}>
                Create new recipe…
              </MenuItem>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 12px',
        background: '#fff', border: 'none',
        fontFamily: 'var(--font-primary)',
        fontSize: 12.5, fontWeight: 500,
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SummaryDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-secondary)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

function MatchPill({ state }: { state: RowState }) {
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
  width: '100%', maxWidth: 320,
  padding: '6px 10px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
};

const matchDropdownStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  width: '100%', maxWidth: 320,
  padding: '6px 10px', borderRadius: 8,
  border: '1px dashed var(--color-border-subtle)',
  background: '#fff',
  fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  textAlign: 'left',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8,
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600,
  fontFamily: 'var(--font-primary)', cursor: 'pointer',
};

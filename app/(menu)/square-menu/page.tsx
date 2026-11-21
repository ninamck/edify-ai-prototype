'use client';

/**
 * Square menu: what Edify sells through Square, and what the next publish
 * will send. Only shows for Square customers with publishing turned on.
 *
 * Item matching stays the vendor-neutral page for linking till buttons to
 * recipes and products. This page owns the till-side fields (till name,
 * sizes, till price, sites, VAT) and the review-and-publish step. Both
 * pages read the same links.
 */

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Plus, Search, Send, Settings } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts } from '@/components/Suppliers/store';
import { useModifierGroups } from '@/components/Modifiers/store';
import { GroupEditorDrawer } from '@/components/Modifiers/GroupEditorDrawer';
import type { ModifierGroup } from '@/components/Modifiers/types';
import { MatchPicker } from '@/components/ItemMatching/MatchPicker';
import {
  groupTillStatus,
  linkSquareOnly,
  publishCount,
  squareChangeCount,
  useSquareMenu,
} from '@/components/SquareMenu/squareMenuStore';
import {
  FIELD_LABELS,
  priceRange,
  publishKeys,
  squareChangeKeys,
  statusOf,
  type SquareOnlyItem,
  type TillItem,
  type TillStatus,
} from '@/components/SquareMenu/tillItems';
import {
  SourceChip,
  TillStatusPill,
  card,
  eyebrow,
  linkBtn,
  primaryBtn,
  secondaryBtn,
} from '@/components/SquareMenu/ui';
import { SquareMenuItemDrawer } from '@/components/SquareMenu/SquareMenuItemDrawer';
import { PublishSheet } from '@/components/SquareMenu/PublishSheet';
import { ChangedInSquarePanel } from '@/components/SquareMenu/ChangedInSquarePanel';
import { AddTillItemsPicker } from '@/components/SquareMenu/AddTillItemsPicker';
import { FirstLinkFlow } from '@/components/SquareMenu/FirstLinkFlow';

type Filter = 'all' | TillStatus;

/** Filter order: what needs a decision first, what's fine last. */
const FILTER_ORDER: TillStatus[] = ['changed', 'blocked', 'ready', 'not-on-till', 'till-only', 'in-sync'];

const TILE_LABEL: Record<TillStatus, string> = {
  'in-sync': 'Up to date',
  ready: 'Ready to publish',
  changed: 'Changed in Square',
  'not-on-till': 'Not on the till',
  'till-only': 'On the till only',
  blocked: "Can't publish",
};

type Row =
  | { kind: 'item'; id: string; item: TillItem; status: TillStatus; name: string }
  | { kind: 'square'; id: string; sq: SquareOnlyItem; status: 'till-only'; name: string };

function groupNames(ids: string[], groups: ModifierGroup[]): string {
  return ids.map((id) => groups.find((g) => g.id === id)?.name ?? id).join(', ');
}

/** One line under the status pill saying what is going on, in plain words. */
function statusLine(item: TillItem, status: TillStatus, groups: ModifierGroup[]): string | null {
  if (status === 'changed') {
    if (item.deletedInSquare) return 'Deleted in Square';
    const keys = squareChangeKeys(item);
    if (keys.length === 1 && keys[0] === 'name') return `Renamed to "${item.inSquare?.name}"`;
    if (keys.length === 1 && keys[0] === 'prices') return 'Price changed in Square';
    return `${keys.length} changes in Square`;
  }
  if (status === 'ready') {
    if (item.takeOff) return 'Coming off the till';
    if (item.regularTypeInSquare && publishKeys(item).length === 0) return 'Becomes a food and drink item';
    const keys = publishKeys(item);
    return keys.map((k) => FIELD_LABELS[k].toLowerCase()).join(', ').replace(/^./, (c) => c.toUpperCase());
  }
  if (status === 'blocked' && item.sizeGroups) {
    const all = Array.from(new Set(Object.values(item.sizeGroups).flat()));
    const partial = all.filter((g) => !Object.values(item.sizeGroups!).every((l) => l.includes(g)));
    const sizes = Object.entries(item.sizeGroups).filter(([, l]) => partial.some((g) => l.includes(g))).map(([s]) => s);
    return `${groupNames(partial, groups)} on ${sizes.join(', ')} only`;
  }
  if (status === 'not-on-till') return 'Goes on the till next publish';
  return null;
}

function SquareMenuInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sm = useSquareMenu();
  const recipes = useRecipes();
  const products = useProducts();
  const groups = useModifierGroups();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(params.get('item'));
  const [publishOpen, setPublishOpen] = useState(params.get('publish') === '1');
  const [changesOpen, setChangesOpen] = useState(params.get('review') === 'changes');
  const [addOpen, setAddOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState<ModifierGroup | null>(null);

  const rows = useMemo<Row[]>(() => {
    const items: Row[] = sm.items.map((item) => ({
      kind: 'item', id: item.id, item, status: statusOf(item), name: item.current.name,
    }));
    const sq: Row[] = sm.squareOnly.map((s) => ({ kind: 'square', id: s.id, sq: s, status: 'till-only', name: s.name }));
    return [...items, ...sq];
  }, [sm.items, sm.squareOnly]);

  const counts = useMemo(() => {
    const c: Record<TillStatus, number> = { 'in-sync': 0, ready: 0, changed: 0, 'not-on-till': 0, 'till-only': 0, blocked: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => FILTER_ORDER.indexOf(a.status) - FILTER_ORDER.indexOf(b.status) || a.name.localeCompare(b.name));
  }, [rows, filter, query]);

  const changes = squareChangeCount(sm);
  const toPublish = publishCount(sm, groups);
  const tillGroups = groups.filter((g) => groupTillStatus(g, sm) !== 'unused');

  if (!sm.settings.enabled) {
    return (
      <Page>
        <div style={{ ...card, padding: 24, maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Publishing to Square is off</h1>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '8px 0 16px' }}>
            Turn it on from your Square connection to build the till from your recipes and products.
          </p>
          <button type="button" style={primaryBtn} onClick={() => router.push('/pos-connection')}>
            <Settings size={14} /> Go to POS connection
          </button>
        </div>
      </Page>
    );
  }

  if (sm.stage === 'first-link') {
    return (
      <Page>
        <FirstLinkFlow />
      </Page>
    );
  }

  if (sm.stage === 'empty') {
    return (
      <Page>
        <EmptyStart onAdd={() => setAddOpen(true)} />
        {addOpen && <AddTillItemsPicker onClose={() => setAddOpen(false)} onAdded={(id) => { setAddOpen(false); setOpenItem(id ?? null); }} />}
        {openItem && <SquareMenuItemDrawer itemId={openItem} onClose={() => setOpenItem(null)} />}
      </Page>
    );
  }

  return (
    <Page>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{rows.length} items on your Square menu</h1>
          {sm.settings.lastPublishedAt && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              Last published {sm.settings.lastPublishedAt}
            </p>
          )}
        </div>
        <button type="button" style={secondaryBtn} onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add items
        </button>
        <button
          type="button"
          style={{ ...primaryBtn, opacity: toPublish === 0 ? 0.5 : 1, cursor: toPublish === 0 ? 'not-allowed' : 'pointer' }}
          disabled={toPublish === 0}
          onClick={() => setPublishOpen(true)}
        >
          <Send size={14} /> Publish to Square
          {toPublish > 0 && (
            <span style={{ padding: '1px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.18)', fontSize: 11.5, fontWeight: 700 }}>
              {toPublish}
            </span>
          )}
        </button>
      </div>

      {changes > 0 && (
        <div
          role="status"
          style={{
            ...card,
            marginTop: 16,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            borderColor: 'var(--color-warning, #B45309)',
          }}
        >
          <span style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text-primary)', minWidth: 240 }}>
            <strong>{changes} {changes === 1 ? 'change' : 'changes'} made in Square</strong> since your last publish. Want to review {changes === 1 ? 'it' : 'them'}?
          </span>
          <button type="button" style={primaryBtn} onClick={() => setChangesOpen(true)}>
            Review changes
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px', flexWrap: 'wrap' }}>
        <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FilterChip label="All" count={rows.length} active={filter === 'all'} onClick={() => setFilter('all')} />
          {FILTER_ORDER.filter((st) => counts[st] > 0).map((st) => (
            <FilterChip
              key={st}
              label={TILE_LABEL[st]}
              count={counts[st]}
              active={filter === st}
              onClick={() => setFilter(filter === st ? 'all' : st)}
            />
          ))}
        </div>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: '#fff', border: '1px solid var(--color-border)',
            minWidth: 200, flex: '0 1 260px',
          }}
        >
          <Search size={14} color="var(--color-text-muted)" aria-hidden />
          <input
            aria-label="Search the Square menu"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      <div style={{ ...card, overflow: 'visible', borderColor: 'var(--color-border)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            gap: 12,
            padding: '11px 16px',
            background: '#FBFAF8',
            borderBottom: '1px solid var(--color-border)',
            borderTopLeftRadius: 12, borderTopRightRadius: 12,
            ...eyebrow,
            fontSize: 11.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          <span>Item</span>
          <span>Sizes</span>
          <span>Till price</span>
          <span>Status</span>
          <span aria-hidden />
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No items match.
          </div>
        ) : (
          filtered.map((r) =>
            r.kind === 'item' ? (
              <ItemRow
                key={r.id}
                item={r.item}
                status={r.status}
                sourceName={sourceName(r.item, recipes, products)}
                line={statusLine(r.item, r.status, groups)}
                onOpen={() => (r.status === 'changed' ? setChangesOpen(true) : setOpenItem(r.id))}
                onEdit={() => setOpenItem(r.id)}
              />
            ) : (
              <SquareOnlyRow
                key={r.id}
                sq={r.sq}
                pickerOpen={linkFor === r.id}
                onLink={() => setLinkFor(linkFor === r.id ? null : r.id)}
                onClosePicker={() => setLinkFor(null)}
                onPicked={(target) => {
                  setLinkFor(null);
                  if (target.type === 'recipe') linkSquareOnly(r.id, { kind: 'recipe', recipeId: target.id });
                  else if (target.type === 'product') linkSquareOnly(r.id, { kind: 'product', productId: target.id });
                }}
                onCreate={() => router.push('/recipes/intake/pos')}
              />
            ),
          )
        )}
      </div>

      {tillGroups.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '28px 0 10px' }}>Modifier groups</h2>
          <div style={{ ...card, borderColor: 'var(--color-border)' }}>
            {tillGroups.map((g, idx) => {
              const st = groupTillStatus(g, sm);
              const used = sm.items.filter((i) => i.current.groups.includes(g.id)).length;
              return (
                <div
                  key={g.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 1fr 150px 110px', gap: 12, alignItems: 'center',
                    padding: '11px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                      {g.options.length} options · {g.selection === 'one' ? 'pick one' : g.maxSelections ? `up to ${g.maxSelections}` : 'pick any'}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    On {used} {used === 1 ? 'item' : 'items'}
                  </span>
                  <span>
                    {st === 'changed' ? <TillStatusPill status="changed" /> : st === 'ready' ? <TillStatusPill status="ready" /> : st === 'not-on-till' ? <TillStatusPill status="not-on-till" /> : <TillStatusPill status="in-sync" />}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {st === 'changed' ? (
                      <button type="button" style={secondaryBtn} onClick={() => setChangesOpen(true)}>Review</button>
                    ) : (
                      <button type="button" style={secondaryBtn} onClick={() => setEditGroup(g)}>Edit</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {openItem && <SquareMenuItemDrawer itemId={openItem} onClose={() => setOpenItem(null)} />}
      {publishOpen && (
        <PublishSheet
          onClose={() => setPublishOpen(false)}
          onOpenItem={(id) => { setPublishOpen(false); setOpenItem(id); }}
          onReviewChanges={() => { setPublishOpen(false); setChangesOpen(true); }}
        />
      )}
      {changesOpen && (
        <ChangedInSquarePanel
          onClose={() => setChangesOpen(false)}
          onEditGroup={(g) => { setChangesOpen(false); setEditGroup(g); }}
        />
      )}
      {addOpen && <AddTillItemsPicker onClose={() => setAddOpen(false)} onAdded={(id) => { setAddOpen(false); setOpenItem(id ?? null); }} />}
      <GroupEditorDrawer
        open={!!editGroup}
        mode="edit"
        initial={editGroup}
        onClose={() => setEditGroup(null)}
        onSaved={() => setEditGroup(null)}
      />
    </Page>
  );
}

const GRID = '1.8fr 1.3fr 120px 1.3fr 120px';

/** Same as the "Match to…" control on Item matching. */
const matchDropdownStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  width: '100%',
  padding: '6px 10px', borderRadius: 8,
  border: '1px dashed var(--color-border)',
  background: '#fff',
  fontSize: 12.5, fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  textAlign: 'left',
};

function sourceName(item: TillItem, recipes: ReturnType<typeof useRecipes>, products: ReturnType<typeof useProducts>): string {
  if (item.source.kind === 'recipe') {
    const id = item.source.recipeId;
    return recipes.find((r) => r.id === id)?.name ?? 'Recipe';
  }
  const id = item.source.productId;
  return products.find((p) => p.id === id)?.name ?? 'Product';
}

function ItemRow({
  item, status, sourceName: src, line, onOpen, onEdit,
}: {
  item: TillItem;
  status: TillStatus;
  sourceName: string;
  line: string | null;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const f = item.current;
  const meta = [
    ...(item.source.kind === 'product' ? ['product'] : []),
    ...(src.toLowerCase() !== f.name.toLowerCase() ? [src] : []),
    ...(f.sites.length > 0 ? [`${f.sites.length} ${f.sites.length === 1 ? 'site' : 'sites'}`] : []),
    ...(!f.category ? ['No till category'] : []),
    ...(item.soldOutAt?.length ? [`Sold out at ${item.soldOutAt.join(', ')}`] : []),
  ];
  const action = status === 'changed' ? 'Review' : status === 'blocked' ? 'Fix' : null;
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        background: item.takeOff ? '#FBFAF8' : undefined,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Open ${f.name}`}
          style={{
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)', textAlign: 'left',
            textDecoration: item.takeOff ? 'line-through' : 'none',
          }}
        >
          {f.name}
        </button>
        {meta.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
            {item.source.kind === 'product' && <SourceChip kind="product" />}
            {meta.filter((m) => m !== 'product').join(' · ')}
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
        {f.sizes.length === 1 && ['Regular', 'Each'].includes(f.sizes[0]) ? 'One size' : f.sizes.join(', ')}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{priceRange(f)}</span>
      <div style={{ minWidth: 0 }}>
        <TillStatusPill status={status} />
        {line && <div style={{ fontSize: 12.5, color: 'var(--color-text-primary)', marginTop: 4 }}>{line}</div>}
      </div>
      <span style={{ textAlign: 'right' }}>
        {action && (
          <button type="button" style={secondaryBtn} onClick={onOpen} aria-label={`${action} ${f.name}`}>
            {action}
          </button>
        )}
      </span>
    </div>
  );
}

function SquareOnlyRow({
  sq, pickerOpen, onLink, onClosePicker, onPicked, onCreate,
}: {
  sq: SquareOnlyItem;
  pickerOpen: boolean;
  onLink: () => void;
  onClosePicker: () => void;
  onPicked: (target: { type: 'recipe' | 'product' | 'master-product'; id: string }) => void;
  onCreate: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid var(--color-border)',
        position: 'relative',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sq.name}</div>
        {sq.createdAt && (
          <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3 }}>Added in Square {sq.createdAt}</div>
        )}
      </div>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
        {sq.sizes.length === 1 ? 'One size' : sq.sizes.join(', ')}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{priceRange({ sizes: sq.sizes, prices: sq.prices } as TillItem['current'])}</span>
      <div>
        <TillStatusPill status="till-only" />
        <div style={{ fontSize: 12.5, marginTop: 4 }}>
          <button type="button" style={{ ...linkBtn, fontSize: 12.5 }} onClick={onCreate}>Create a recipe</button>
        </div>
      </div>
      <span style={{ textAlign: 'right', position: 'relative' }}>
        <button
          type="button"
          onClick={onLink}
          aria-expanded={pickerOpen}
          aria-label={`Match ${sq.name} to a recipe or product`}
          style={{
            ...matchDropdownStyle,
            ...(pickerOpen ? { borderStyle: 'solid', borderColor: 'var(--color-accent-active)' } : null),
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Match to…
          </span>
          <ChevronDown size={14} aria-hidden />
        </button>
        {pickerOpen && (
          <MatchPicker
            posItemId={sq.id}
            onClose={onClosePicker}
            align="right"
            onPick={(t) => onPicked(t)}
          />
        )}
      </span>
    </div>
  );
}

function EmptyStart({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ ...card, padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your Square menu is empty</h1>
      <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '6px 0 16px' }}>
        Pick the recipes and products you sell. Nothing goes to Square until you publish.
      </p>
      <button type="button" style={primaryBtn} onClick={onAdd}>
        <Plus size={14} /> Choose what you sell
      </button>
    </div>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 12px', borderRadius: 100,
        border: active ? '1px solid transparent' : '1px solid var(--color-border)',
        background: active ? 'var(--color-accent-active)' : '#fff',
        color: active ? '#fff' : 'var(--color-text-primary)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {label}
      <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? 'rgba(255,255,255,0.85)' : 'var(--color-text-secondary)' }}>{count}</span>
    </button>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 24px 120px', maxWidth: 1120, margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {children}
    </div>
  );
}

export default function SquareMenuPage() {
  return (
    <Suspense fallback={null}>
      <SquareMenuInner />
    </Suspense>
  );
}

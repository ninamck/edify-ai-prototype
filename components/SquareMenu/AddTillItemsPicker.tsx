'use client';

/**
 * Add items: how the Square menu list gets built. Two tabs, Recipes and
 * Products. Things that look sellable come first (active, priced, not a
 * prep or component recipe; products sold as they are). Show all reveals
 * the rest. Products get sizes as amounts of the product, so a bottle of
 * house red can sell as 175ml, 250ml and a bottle.
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts } from '@/components/Suppliers/store';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { Product } from '@/components/Suppliers/fixtures';
import {
  addProductToTill,
  addRecipeToTill,
  defaultProductSizes,
  useSquareMenu,
  type ProductSize,
} from './squareMenuStore';
import { money } from './tillItems';
import { NumberField, Sheet, eyebrow, inputStyle, linkBtn, primaryBtn, secondaryBtn } from './ui';

type Tab = 'recipes' | 'products';

function sellableRecipe(r: Recipe): boolean {
  return r.status === 'Active' && r.kind !== 'component' && !r.isPrep && r.priceDineIn > 0;
}

function sellableProduct(p: Product): boolean {
  return p.tags.includes('whole-drink') || (p.category === 'Beverage' && p.productClass === 'Beverage' && p.source !== 'made');
}

export function AddTillItemsPicker({ onClose, onAdded }: { onClose: () => void; onAdded: (id?: string) => void }) {
  const sm = useSquareMenu();
  const recipes = useRecipes();
  const products = useProducts();
  const [tab, setTab] = useState<Tab>('recipes');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [pickedRecipes, setPickedRecipes] = useState<Set<string>>(new Set());
  const [pickedProducts, setPickedProducts] = useState<Record<string, ProductSize[]>>({});

  const onTillRecipe = new Set(sm.items.flatMap((i) => (i.source.kind === 'recipe' ? [i.source.recipeId] : [])));
  const onTillProduct = new Set(sm.items.flatMap((i) => (i.source.kind === 'product' ? [i.source.productId] : [])));

  const q = query.trim().toLowerCase();

  const recipeRows = useMemo(() => {
    const avail = recipes.filter((r) => !onTillRecipe.has(r.id) && r.status !== 'Archived' && (!q || r.name.toLowerCase().includes(q)));
    const suggested = avail.filter(sellableRecipe);
    const rest = avail.filter((r) => !sellableRecipe(r));
    return { suggested, rest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, sm.items, q]);

  const productRows = useMemo(() => {
    const avail = products.filter((p) => !onTillProduct.has(p.id) && p.status !== 'Unavailable' && (!q || p.name.toLowerCase().includes(q)));
    const suggested = avail.filter(sellableProduct);
    const rest = avail.filter((p) => !sellableProduct(p));
    return { suggested, rest };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sm.items, q]);

  const pickedCount = pickedRecipes.size + Object.keys(pickedProducts).length;

  function toggleRecipe(id: string) {
    setPickedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProduct(p: Product) {
    setPickedProducts((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = defaultProductSizes(p);
      return next;
    });
  }

  function setSizes(pid: string, sizes: ProductSize[]) {
    setPickedProducts((prev) => ({ ...prev, [pid]: sizes }));
  }

  function add() {
    const ids: string[] = [];
    for (const id of pickedRecipes) {
      const r = recipes.find((x) => x.id === id);
      if (r) ids.push(addRecipeToTill(r));
    }
    for (const [pid, sizes] of Object.entries(pickedProducts)) {
      const p = products.find((x) => x.id === pid);
      if (p && sizes.length) ids.push(addProductToTill(p, sizes));
    }
    onAdded(ids.length === 1 ? ids[0] : undefined);
  }

  const footer = (
    <>
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Added items wait for your next publish. Nothing reaches the till yet.
      </span>
      <button type="button" style={secondaryBtn} onClick={onClose}>Cancel</button>
      <button
        type="button"
        style={{ ...primaryBtn, opacity: pickedCount ? 1 : 0.5, cursor: pickedCount ? 'pointer' : 'not-allowed' }}
        disabled={!pickedCount}
        onClick={add}
      >
        <Plus size={14} /> Add {pickedCount || ''} to the list
      </button>
    </>
  );

  const rows = tab === 'recipes' ? recipeRows : productRows;

  return (
    <Sheet eyebrowText="Square menu" title="Add items to the till" onClose={onClose} footer={footer} width={720}>
      <div role="tablist" aria-label="What to add" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['recipes', 'products'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setShowAll(false); }}
            style={{
              padding: '7px 14px', borderRadius: 100,
              border: tab === t ? '1px solid transparent' : '1px solid var(--color-border-subtle)',
              background: tab === t ? 'var(--color-accent-active)' : '#fff',
              color: tab === t ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-primary)',
            }}
          >
            {t === 'recipes' ? 'Recipes' : 'Products'}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          background: '#fff', border: '1px solid var(--color-border-subtle)',
          marginBottom: 14,
        }}
      >
        <Search size={14} color="var(--color-text-muted)" aria-hidden />
        <input
          aria-label={`Search ${tab}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'recipes' ? 'Search recipes' : 'Search products'}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-primary)', fontSize: 13 }}
        />
      </div>

      <h3 style={{ ...eyebrow, margin: '0 0 6px' }}>
        {tab === 'recipes' ? 'Recipes you sell' : 'Products sold as they are'} · {rows.suggested.length}
      </h3>
      <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
        {tab === 'recipes'
          ? 'Active recipes with a price that are not on the till yet.'
          : 'Drinks and other products you sell without a recipe.'}
      </p>
      <List>
        {tab === 'recipes'
          ? recipeRows.suggested.map((r) => (
            <RecipeRow key={r.id} r={r} on={pickedRecipes.has(r.id)} onToggle={() => toggleRecipe(r.id)} />
          ))
          : productRows.suggested.map((p) => (
            <ProductRow key={p.id} p={p} sizes={pickedProducts[p.id]} onToggle={() => toggleProduct(p)} onSizes={(s) => setSizes(p.id, s)} />
          ))}
        {rows.suggested.length === 0 && <Empty>Everything here is already on the list.</Empty>}
      </List>

      {rows.rest.length > 0 && (
        showAll ? (
          <>
            <h3 style={{ ...eyebrow, margin: '16px 0 6px' }}>
              {tab === 'recipes' ? 'Other recipes' : 'Other products'} · {rows.rest.length}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
              {tab === 'recipes' ? 'Drafts, prep and components. Most of these aren’t sold on their own.' : 'Ingredients and packaging. Most of these aren’t sold on their own.'}
            </p>
            <List>
              {tab === 'recipes'
                ? recipeRows.rest.map((r) => (
                  <RecipeRow key={r.id} r={r} on={pickedRecipes.has(r.id)} onToggle={() => toggleRecipe(r.id)} />
                ))
                : productRows.rest.map((p) => (
                  <ProductRow key={p.id} p={p} sizes={pickedProducts[p.id]} onToggle={() => toggleProduct(p)} onSizes={(s) => setSizes(p.id, s)} />
                ))}
            </List>
          </>
        ) : (
          <button type="button" style={{ ...linkBtn, marginTop: 12 }} onClick={() => setShowAll(true)}>
            Show all {tab} ({rows.rest.length} more)
          </button>
        )
      )}
    </Sheet>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>{children}</div>;
}

function RecipeRow({ r, on, onToggle }: { r: Recipe; on: boolean; onToggle: () => void }) {
  const sizes = r.variants?.length ?? 0;
  const id = `add-${r.id}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)', marginTop: -1 }}>
      <input id={id} type="checkbox" checked={on} onChange={onToggle} />
      <label htmlFor={id} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{r.name}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
          {r.category}
          {sizes > 1 ? ` · ${sizes} sizes` : ''}
          {r.status !== 'Active' ? ` · ${r.status}` : ''}
        </span>
      </label>
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{r.priceDineIn > 0 ? `Sells at ${money(r.priceDineIn)}` : 'No price'}</span>
    </div>
  );
}

function ProductRow({
  p, sizes, onToggle, onSizes,
}: {
  p: Product;
  sizes?: ProductSize[];
  onToggle: () => void;
  onSizes: (s: ProductSize[]) => void;
}) {
  const id = `add-${p.id}`;
  const unit = p.singleUnitType === 'ml' ? 'ml' : 'each';
  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border-subtle)', marginTop: -1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input id={id} type="checkbox" checked={!!sizes} onChange={onToggle} />
        <label htmlFor={id} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{p.name}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            {p.category} · pack of {p.packQty}
          </span>
        </label>
      </div>
      {sizes && (
        <div style={{ margin: '10px 0 2px 26px', padding: 10, borderRadius: 8, background: '#FBFAF8' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>How you sell it</div>
          {sizes.map((s, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <input
                aria-label="Size name"
                style={{ ...inputStyle, width: 120 }}
                value={s.name}
                onChange={(e) => onSizes(sizes.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
              />
              <NumberField
                ariaLabel={`Amount of ${p.name} in ${s.name}`}
                width={70}
                value={s.amount}
                onChange={(v) => onSizes(sizes.map((x, i) => (i === idx ? { ...x, amount: v ?? 0 } : x)))}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', width: 32 }}>{unit}</span>
              <span aria-hidden style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>£</span>
              <NumberField
                ariaLabel={`Till price for ${s.name}`}
                width={80}
                decimals={2}
                placeholder="At the till"
                value={s.price}
                onChange={(v) => onSizes(sizes.map((x, i) => (i === idx ? { ...x, price: v } : x)))}
              />
              {sizes.length > 1 && (
                <button type="button" aria-label={`Remove ${s.name}`} style={{ ...linkBtn, textDecoration: 'none' }} onClick={() => onSizes(sizes.filter((_, i) => i !== idx))}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            style={linkBtn}
            onClick={() => onSizes([...sizes, { name: '', amount: 1, unit, price: null }])}
          >
            <Plus size={12} aria-hidden /> Add a size
          </button>
        </div>
      )}
    </div>
  );
}

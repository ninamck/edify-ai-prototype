'use client';

/**
 * Till item drawer. Everything the till needs that a recipe doesn't:
 * till name, kitchen name, till category, till price per size and site,
 * sites and VAT. Allergens are read from the recipe or product.
 *
 * Edits save as you type and wait for the next publish. Nothing here is
 * required beyond a name and one size; blanks show as suggestions.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, Plus, Trash2, Undo2 } from 'lucide-react';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { useProducts } from '@/components/Suppliers/store';
import { useModifierGroups } from '@/components/Modifiers/store';
import { SITES } from '@/components/Recipe/RecipeFormParts';
import type { Recipe } from '@/components/Recipe/libraryFixtures';
import type { Product } from '@/components/Suppliers/fixtures';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  alignSizeGroups,
  dropSize,
  optionOffCopy,
  optionsOffOnSizes,
  removeFromList,
  setTakeOff,
  updateFields,
  updateItem,
  useSquareMenu,
} from './squareMenuStore';
import { SQUARE_CATEGORIES, SQUARE_TAXES } from './squareCatalogFixtures';
import { gpPct, isBlocked, money, statusOf, type TillItem } from './tillItems';
import {
  FieldLabel,
  NumberField,
  PillToggle,
  Section,
  Sheet,
  TillStatusPill,
  inputStyle,
  linkBtn,
  primaryBtn,
  secondaryBtn,
} from './ui';

/** Allergens as the recipe or product holds them. Read only on the till. */
export function allergensFor(item: TillItem, recipes: Recipe[], products: Product[]): string[] {
  if (item.source.kind === 'product') {
    const pid = item.source.productId;
    return products.find((p) => p.id === pid)?.allergensContains ?? [];
  }
  const rid = item.source.recipeId;
  const r = recipes.find((x) => x.id === rid);
  if (!r) return [];
  if (r.formExtras?.allergens?.length) return r.formExtras.allergens;
  const names = r.ingredients.map((i) => i.name.toLowerCase()).join(' ');
  const out: string[] = [];
  if (/milk|cream|butter|cheese|yoghurt/.test(names) && !/oat milk only/.test(names)) out.push('Dairy');
  if (/flour|bread|sourdough|croissant|muffin|bagel|pastry|batter/.test(names) || ['Pastry', 'Bakery'].includes(r.category)) out.push('Cereals containing gluten');
  if (/egg/.test(names)) out.push('Eggs');
  if (/almond|hazelnut|nut/.test(names)) out.push('Nuts');
  if (/salmon|fish/.test(names)) out.push('Fish');
  if (/wine|prosecco/.test(names) || r.category === 'Wine') out.push('Sulphites');
  return out;
}

export function SquareMenuItemDrawer({ itemId, onClose, onReviewChanges }: { itemId: string; onClose: () => void; onReviewChanges?: () => void }) {
  const router = useRouter();
  const sm = useSquareMenu();
  const recipes = useRecipes();
  const products = useProducts();
  const groups = useModifierGroups();
  const item = sm.items.find((i) => i.id === itemId);
  const [sitePriceOpen, setSitePriceOpen] = useState<string | null>(null);
  const [newSize, setNewSize] = useState<{ name: string; amount: string } | null>(null);

  if (!item) return null;
  const f = item.current;
  const status = statusOf(item);
  const blocked = isBlocked(item);
  const allergens = allergensFor(item, recipes, products);
  const isProduct = item.source.kind === 'product';
  const sourceHref = item.source.kind === 'recipe' ? `/recipes/${item.source.recipeId}/edit` : '/suppliers';
  const sourceLabel = item.source.kind === 'recipe'
    ? recipes.find((r) => r.id === (item.source as { recipeId: string }).recipeId)?.name ?? 'recipe'
    : products.find((p) => p.id === (item.source as { productId: string }).productId)?.name ?? 'product';

  function setPrice(size: string, v: number | null) {
    updateFields(item!.id, { prices: { ...f.prices, [size]: v } });
  }

  function setSitePrice(size: string, site: string, v: number | null) {
    const all = { ...(item!.sitePrices ?? {}) };
    const forSize = { ...(all[size] ?? {}) };
    if (v == null) delete forSize[site];
    else forSize[site] = v;
    all[size] = forSize;
    updateItem(item!.id, { sitePrices: all });
  }

  function toggleGroup(id: string) {
    const next = f.groups.includes(id) ? f.groups.filter((g) => g !== id) : [...f.groups, id];
    updateFields(item!.id, { groups: next });
  }

  function toggleSite(site: string) {
    const current = f.sites.length === 0 ? [...SITES] : f.sites;
    const next = current.includes(site) ? current.filter((s) => s !== site) : [...current, site];
    updateFields(item!.id, { sites: next.length === SITES.length ? [] : next });
  }

  function addProductSize() {
    if (!newSize || !newSize.name.trim()) return;
    const name = newSize.name.trim();
    const amount = Number(newSize.amount) || 1;
    const unit = item!.amounts ? Object.values(item!.amounts)[0]?.unit ?? 'each' : 'each';
    updateItem(item!.id, {
      amounts: { ...(item!.amounts ?? {}), [name]: { value: amount, unit } },
      current: { ...f, sizes: [...f.sizes, name], prices: { ...f.prices, [name]: null } },
    });
    setNewSize(null);
  }

  function removeSize(size: string) {
    if (f.sizes.length <= 1) return;
    const prices = { ...f.prices };
    delete prices[size];
    updateFields(item!.id, { sizes: f.sizes.filter((s) => s !== size), prices });
  }

  const blockedGroups = blocked && item.sizeGroups
    ? Array.from(new Set(Object.values(item.sizeGroups).flat())).filter((g) => !Object.values(item.sizeGroups!).every((l) => l.includes(g)))
    : [];
  const blockedSizes = blocked && item.sizeGroups
    ? Object.entries(item.sizeGroups).filter(([, l]) => blockedGroups.some((g) => l.includes(g))).map(([s]) => s)
    : [];

  const footer = (
    <>
      {item.takeOff ? (
        <button type="button" style={secondaryBtn} onClick={() => setTakeOff(item.id, false)}>
          <Undo2 size={14} /> Keep it on the till
        </button>
      ) : item.inSquare ? (
        <button type="button" style={secondaryBtn} onClick={() => setTakeOff(item.id, true)}>
          <Trash2 size={14} /> Take off the till
        </button>
      ) : (
        <button type="button" style={secondaryBtn} onClick={() => { removeFromList(item.id); onClose(); }}>
          <Trash2 size={14} /> Remove from the list
        </button>
      )}
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        Saves as you go. Publish to send it to the till.
      </span>
      <button type="button" style={primaryBtn} onClick={onClose}>Done</button>
    </>
  );

  return (
    <Sheet
      title={f.name || 'Untitled'}
      onClose={onClose}
      headerRight={<TillStatusPill status={status} />}
      footer={footer}
    >
      {item.takeOff && (
        <Notice tone="info">
          This comes off the till on your next publish. Square keeps its sales history.
        </Notice>
      )}

      {status === 'changed' && onReviewChanges && (
        <Notice tone="warning">
          This was changed in Square. Review it first so you don&apos;t overwrite it.{' '}
          <button type="button" style={linkBtn} onClick={onReviewChanges}>Review the change</button>
        </Notice>
      )}

      {blocked && (
        <Notice tone="error">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Square can&apos;t put {blockedGroups.map((g) => groups.find((x) => x.id === g)?.name ?? g).join(', ')} on {blockedSizes.join(', ')} only.
          </div>
          <div style={{ marginBottom: 10 }}>
            Square gives every size the same modifier groups. Pick a fix to publish it.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={secondaryBtn} onClick={() => alignSizeGroups(item.id)}>
              Put {blockedGroups.map((g) => groups.find((x) => x.id === g)?.name ?? g).join(', ')} on every size
            </button>
            {blockedSizes.map((s) => (
              <button key={s} type="button" style={secondaryBtn} onClick={() => dropSize(item.id, s)}>
                Sell {s} as its own item
              </button>
            ))}
          </div>
        </Notice>
      )}

      {item.regularTypeInSquare && (
        <Notice tone="info">
          Square has this as a regular item, so the till can&apos;t show its allergens. Your next publish makes it a food and drink item.
        </Notice>
      )}

      <Section
        title="On the till"
        hint={sourceLabel.toLowerCase() !== f.name.toLowerCase() ? `From the ${isProduct ? 'product' : 'recipe'} ${sourceLabel}` : undefined}
        right={
          <button type="button" style={linkBtn} onClick={() => router.push(sourceHref)}>
            Open {isProduct ? 'product' : 'recipe'} <ExternalLink size={12} aria-hidden />
          </button>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="sq-name">Till name</FieldLabel>
            <input id="sq-name" style={inputStyle} value={f.name} onChange={(e) => updateFields(item.id, { name: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="sq-category">Till category</FieldLabel>
            <select
              id="sq-category"
              style={inputStyle}
              value={f.category}
              onChange={(e) => updateFields(item.id, { category: e.target.value })}
            >
              <option value="">No category</option>
              {SQUARE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section
        title="Sizes and till prices"
        hint={isProduct
          ? 'Prices include VAT. The amount is what each size takes off stock.'
          : 'Prices include VAT. Leave blank to price at the till.'}
      >
        <div id="sq-prices" role="table" aria-label="Sizes and till prices">
          <div
            role="row"
            style={{
              display: 'grid', gridTemplateColumns: isProduct ? '1.2fr 110px 120px 70px 1fr' : '1.4fr 120px 70px 1fr',
              gap: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: 'var(--color-text-muted)', paddingBottom: 6,
            }}
          >
            <span role="columnheader">Size</span>
            {isProduct && <span role="columnheader">Amount</span>}
            <span role="columnheader">Till price</span>
            <span role="columnheader">GP</span>
            <span role="columnheader" />
          </div>
          {f.sizes.map((s) => {
            const gp = gpPct(f.prices[s], item.sizeCosts[s], f.vat);
            const sp = item.sitePrices?.[s] ?? {};
            const spCount = Object.keys(sp).length;
            return (
              <div key={s} role="row" style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '8px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isProduct ? '1.2fr 110px 120px 70px 1fr' : '1.4fr 120px 70px 1fr', gap: 10, alignItems: 'center' }}>
                  <span role="cell" style={{ fontSize: 13, fontWeight: 600 }}>{s}</span>
                  {isProduct && (
                    <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <NumberField
                        ariaLabel={`Amount for ${s}`}
                        width={64}
                        value={item.amounts?.[s]?.value}
                        onChange={(v) => updateItem(item.id, {
                          amounts: { ...(item.amounts ?? {}), [s]: { value: v ?? 0, unit: item.amounts?.[s]?.unit ?? 'each' } },
                        })}
                      />
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{item.amounts?.[s]?.unit ?? 'each'}</span>
                    </span>
                  )}
                  <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span aria-hidden style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>£</span>
                    <NumberField
                      ariaLabel={`Till price for ${s}`}
                      placeholder="At the till"
                      decimals={2}
                      value={f.prices[s]}
                      onChange={(v) => setPrice(s, v)}
                    />
                  </span>
                  <span role="cell" style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {gp == null ? '–' : `${gp}%`}
                  </span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" style={linkBtn} onClick={() => setSitePriceOpen(sitePriceOpen === s ? null : s)} aria-expanded={sitePriceOpen === s}>
                      {spCount > 0 ? `Different at ${spCount} ${spCount === 1 ? 'site' : 'sites'}` : 'Price by site'}
                    </button>
                    {isProduct && f.sizes.length > 1 && (
                      <button type="button" style={linkBtn} onClick={() => removeSize(s)} aria-label={`Remove size ${s}`}>Remove</button>
                    )}
                  </span>
                </div>
                {sitePriceOpen === s && (
                  <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#FBFAF8', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                    {SITES.map((site) => (
                      <label key={site} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <span style={{ flex: 1 }}>{site}</span>
                        <span aria-hidden style={{ color: 'var(--color-text-muted)' }}>£</span>
                        <NumberField
                          ariaLabel={`${s} price at ${site}`}
                          width={80}
                          decimals={2}
                          placeholder={f.prices[s] != null ? f.prices[s]!.toFixed(2) : 'At the till'}
                          value={sp[site]}
                          onChange={(v) => setSitePrice(s, site, v)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isProduct && (
            newSize ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)' }}>
                <input aria-label="New size name" style={{ ...inputStyle, width: 140 }} placeholder="e.g. 125ml" value={newSize.name} onChange={(e) => setNewSize({ ...newSize, name: e.target.value })} />
                <input aria-label="New size amount" style={{ ...inputStyle, width: 80 }} placeholder="Amount" inputMode="decimal" value={newSize.amount} onChange={(e) => setNewSize({ ...newSize, amount: e.target.value })} />
                <button type="button" style={secondaryBtn} onClick={addProductSize}>Add</button>
                <button type="button" style={linkBtn} onClick={() => setNewSize(null)}>Cancel</button>
              </div>
            ) : (
              <button type="button" style={{ ...linkBtn, marginTop: 8 }} onClick={() => setNewSize({ name: '', amount: '' })}>
                <Plus size={12} aria-hidden /> Add a size
              </button>
            )
          )}
        </div>
      </Section>

      <Section title="Modifier groups">
        {optionsOffOnSizes(item).map((o) => (
          <Notice key={`${o.groupName}-${o.optionName}`} tone="warning">{optionOffCopy(o)}</Notice>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {groups.filter((g) => g.id !== 'mg-coffee-size').map((g) => (
            <PillToggle key={g.id} on={f.groups.includes(g.id)} onClick={() => toggleGroup(g.id)}>{g.name}</PillToggle>
          ))}
        </div>
      </Section>

      <Section title="Where it sells">
        <FieldLabel>Sites</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <PillToggle on={f.sites.length === 0} onClick={() => updateFields(item.id, { sites: [] })}>All sites</PillToggle>
          {SITES.map((s) => (
            <PillToggle key={s} on={f.sites.length === 0 || f.sites.includes(s)} onClick={() => toggleSite(s)}>{s}</PillToggle>
          ))}
        </div>
        <FieldLabel htmlFor="sq-vat">VAT</FieldLabel>
        <select id="sq-vat" style={{ ...inputStyle, maxWidth: 280 }} value={f.vat} onChange={(e) => updateFields(item.id, { vat: e.target.value })}>
          {SQUARE_TAXES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Section>

      <Section
        title="Allergens"
        hint={`From the ${isProduct ? 'product' : 'recipe'}. Edit them there.`}
      >
        {allergens.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No allergens recorded.</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allergens.map((a) => <StatusPill key={a} tone="neutral" size="sm" preserveCase>{a}</StatusPill>)}
          </div>
        )}
      </Section>

      <Section title="Tickets and online ordering">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FieldLabel htmlFor="sq-kitchen">Kitchen name</FieldLabel>
            <input
              id="sq-kitchen"
              style={inputStyle}
              value={f.kitchenName}
              placeholder={f.name}
              onChange={(e) => updateFields(item.id, { kitchenName: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sq-photo">Photo</FieldLabel>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 0' }}>
              <input
                id="sq-photo"
                type="checkbox"
                checked={f.photo}
                onChange={(e) => updateFields(item.id, { photo: e.target.checked })}
              />
              Use the {isProduct ? 'product' : 'recipe'} photo
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel htmlFor="sq-description">Description</FieldLabel>
            <textarea
              id="sq-description"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={f.description}
              onChange={(e) => updateFields(item.id, { description: e.target.value })}
            />
          </div>
        </div>
      </Section>

      {item.inSquare && status !== 'in-sync' && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 2px 0' }}>
          On the till now: {item.inSquare.name}, {item.inSquare.sizes.map((s) => `${s} ${money(item.inSquare!.prices[s])}`).join(', ')}.
        </p>
      )}
    </Sheet>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warning' | 'error'; children: React.ReactNode }) {
  const border = tone === 'error' ? 'var(--color-error, #B91C1C)' : tone === 'warning' ? 'var(--color-warning, #B45309)' : 'var(--color-border-subtle)';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '12px 14px', marginBottom: 12,
        background: '#fff', border: `1px solid ${border}`, borderRadius: 12,
        fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.45,
      }}
    >
      {tone !== 'info' && <AlertTriangle size={16} color={border} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export { Notice };

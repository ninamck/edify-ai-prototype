'use client';

import { useMemo, useState } from 'react';
import { Utensils, ArrowRight } from 'lucide-react';
import { findRecipe, useRecipes } from '@/components/Recipe/recipeStore';
import CardShell, { FieldRow, PillRow, type CardState } from './CardShell';
import type { MenuArgs, MenuAction } from '../parsers';

interface MenuActionCardProps {
  initialArgs: MenuArgs;
  state: CardState;
  onConfirm: (final: {
    recipeId: string;
    recipeName: string;
    action: MenuAction;
    price?: number;
    priceDelta?: number;
    previousPrice: number;
    previousAvailable: boolean;
  }) => void;
  onCancel: () => void;
}

const ACTION_LABELS: Record<MenuAction, string> = {
  'availability-off': '84 today',
  'availability-on': 'Back on menu',
  'price-set': 'Set price',
  'price-delta': 'Adjust price',
  'category-change': 'Move section',
};

export default function MenuActionCard({ initialArgs, state, onConfirm, onCancel }: MenuActionCardProps) {
  useRecipes();
  const recipe = useMemo(
    () => (initialArgs.recipeId ? findRecipe(initialArgs.recipeId) : undefined),
    [initialArgs.recipeId],
  );

  const [action, setAction] = useState<MenuAction>(initialArgs.action ?? 'availability-off');
  const [price, setPrice] = useState<string>(initialArgs.price !== undefined ? initialArgs.price.toFixed(2) : '');
  const [priceDelta, setPriceDelta] = useState<string>(
    initialArgs.priceDelta !== undefined ? initialArgs.priceDelta.toFixed(2) : '',
  );

  const previousPrice = recipe?.priceDineIn ?? 0;
  const previousAvailable = recipe?.posLinked ?? true;

  const newPrice = useMemo<number | null>(() => {
    if (action === 'price-set' && price) return Number(price);
    if (action === 'price-delta' && priceDelta) return previousPrice + Number(priceDelta);
    return null;
  }, [action, price, priceDelta, previousPrice]);

  const canConfirm = !!recipe && (
    action === 'availability-off' ||
    action === 'availability-on' ||
    (action === 'price-set' && newPrice !== null && newPrice > 0) ||
    (action === 'price-delta' && newPrice !== null && newPrice > 0)
  );

  return (
    <CardShell
      icon={Utensils}
      title={`Menu — ${recipe?.name ?? initialArgs.recipeName ?? '…'}`}
      subtitle={recipe ? `${recipe.category} · ${ACTION_LABELS[action]}` : 'Pick a recipe'}
      state={state}
      confirmLabel={action === 'availability-off' ? '84 it' : action === 'availability-on' ? 'Put back on' : 'Update price'}
      confirmDisabled={!canConfirm}
      onConfirm={
        recipe
          ? () =>
              onConfirm({
                recipeId: recipe.id,
                recipeName: recipe.name,
                action,
                price: action === 'price-set' && newPrice !== null ? newPrice : undefined,
                priceDelta: action === 'price-delta' && priceDelta ? Number(priceDelta) : undefined,
                previousPrice,
                previousAvailable,
              })
          : undefined
      }
      onCancel={onCancel}
    >
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}
        >
          Action
        </div>
        <PillRow
          options={[
            { value: 'availability-off', label: '84 today' },
            { value: 'availability-on', label: 'Put back on' },
            { value: 'price-set', label: 'Set price' },
            { value: 'price-delta', label: 'Adjust price' },
          ]}
          selected={action}
          onSelect={(v) => setAction(v as MenuAction)}
          disabled={state !== 'pending'}
          small
        />
      </div>

      {(action === 'availability-off' || action === 'availability-on') && (
        <FieldRow label="Currently">
          <span style={{ color: previousAvailable ? '#2D6A4F' : '#9B2226' }}>
            {previousAvailable ? 'Available' : 'Unavailable'}
          </span>
        </FieldRow>
      )}

      {action === 'price-set' && (
        <>
          <FieldRow label="Current price">${previousPrice.toFixed(2)}</FieldRow>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>New</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-muted)' }}>$</span>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              disabled={state !== 'pending'}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              style={{
                width: '90px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
              }}
            />
            {newPrice !== null && newPrice > 0 && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: newPrice > previousPrice ? '#2D6A4F' : newPrice < previousPrice ? '#9B2226' : 'var(--color-text-muted)',
                }}
              >
                <ArrowRight size={12} style={{ verticalAlign: '-2px' }} />{' '}
                {newPrice > previousPrice ? '+' : ''}
                ${(newPrice - previousPrice).toFixed(2)}
              </span>
            )}
          </div>
        </>
      )}

      {action === 'price-delta' && (
        <>
          <FieldRow label="Current price">${previousPrice.toFixed(2)}</FieldRow>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)' }}>Adjust by $</span>
            <input
              type="text"
              inputMode="decimal"
              value={priceDelta}
              disabled={state !== 'pending'}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="0.20 or -0.20"
              style={{
                width: '110px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-primary)',
              }}
            />
            {newPrice !== null && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                <ArrowRight size={12} style={{ verticalAlign: '-2px' }} /> ${newPrice.toFixed(2)}
              </span>
            )}
          </div>
        </>
      )}
    </CardShell>
  );
}

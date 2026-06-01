'use client';

import { useState } from 'react';
import { Plus, ArrowLeftRight, ChevronRight } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import CardShell, { type CardState } from './CardShell';

export type ProductSwapMode = 'add' | 'replace';

interface ProductPurposeCardProps {
  state: CardState;
  /** Pre-selection from earlier (when the operator backs into this
   *  card from a later step). Optional. */
  initialMode?: ProductSwapMode;
  onPick: (input: { mode: ProductSwapMode }) => void;
  onCancel: () => void;
}

/**
 * Step 0 of the product wizard.
 *
 * The wizard handles two related but materially different jobs:
 *
 *   • **Add** a new product to recipes that don't have it yet (most
 *     common case in the wild — adding an alt-milk SKU to every
 *     coffee, adding a new garnish across cocktails, etc.).
 *   • **Replace** an existing product with a new one across recipes
 *     that currently use the old (switching suppliers, replacing a
 *     discontinued SKU, etc.).
 *
 * Branching up front avoids forcing operators through the "what are
 * we replacing?" picker when they're just adding a brand-new
 * ingredient. The downstream cards / mutation logic key off this
 * choice — for `add`, the wizard skips Pick-Replaced entirely and
 * the recipe picker asks for a per-recipe quantity instead of
 * inheriting one from a replaced row.
 *
 * Skipped when the NL parser can already infer the mode (e.g. the
 * operator says "replace whole milk with oat milk").
 */
export default function ProductPurposeCard({
  state,
  initialMode,
  onPick,
  onCancel,
}: ProductPurposeCardProps) {
  const [picked, setPicked] = useState<ProductSwapMode | null>(initialMode ?? null);

  return (
    <CardShell
      icon={EdifyMark}
      title="What are we doing with this product?"
      subtitle="Step 1 — pick the path"
      state={state}
      confirmLabel="Continue"
      confirmDisabled={picked === null}
      onCancel={onCancel}
      onConfirm={() => {
        if (picked) onPick({ mode: picked });
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Option
          mode="add"
          active={picked === 'add'}
          disabled={state !== 'pending'}
          onClick={() => setPicked('add')}
          icon={Plus}
          title="Add it to recipes"
          tagline="Bring in a new ingredient and pick the recipes it should go into."
          example="e.g. add oat milk to every coffee on the menu"
        />
        <Option
          mode="replace"
          active={picked === 'replace'}
          disabled={state !== 'pending'}
          onClick={() => setPicked('replace')}
          icon={ArrowLeftRight}
          title="Replace another product"
          tagline="Bring in a new product and swap an existing one out where it's used."
          example="e.g. switch House Blend coffee from Roaster A to Roaster B"
        />
      </div>
    </CardShell>
  );
}

interface OptionProps {
  mode: ProductSwapMode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  tagline: string;
  example: string;
}

function Option({ active, disabled, onClick, icon: Icon, title, tagline, example }: OptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '12px',
        border: active
          ? '1.5px solid var(--color-accent-active, #001C35)'
          : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
        background: active ? 'rgba(40,175,201,0.06)' : '#fff',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-primary)',
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        (e.currentTarget as HTMLElement).style.background = 'rgba(40,175,201,0.04)';
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        (e.currentTarget as HTMLElement).style.background = '#fff';
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: active ? 'var(--color-accent-active, #001C35)' : 'rgba(40,175,201,0.10)',
          color: active ? '#fff' : 'var(--color-accent-mid, #28AFC9)',
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={active ? '#fff' : 'var(--color-accent-mid, #28AFC9)'} strokeWidth={2.4} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13.5px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginTop: '2px',
            lineHeight: 1.4,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            marginTop: '4px',
            fontStyle: 'italic',
          }}
        >
          {example}
        </div>
      </div>
      <ChevronRight
        size={16}
        color={active ? 'var(--color-accent-active, #001C35)' : 'var(--color-text-muted)'}
        strokeWidth={2.2}
        style={{ flexShrink: 0 }}
      />
    </button>
  );
}

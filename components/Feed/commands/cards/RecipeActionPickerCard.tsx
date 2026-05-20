'use client';

import { ChefHat, ArrowLeftRight, Plus, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RecipeEditKind } from '../parsers';
import CardShell, { type CardState } from './CardShell';

interface RecipeActionPickerCardProps {
  recipeName: string;
  state: CardState;
  onPick: (action: RecipeEditKind) => void;
  onCancel: () => void;
}

const ACTIONS: { kind: RecipeEditKind; label: string; description: string; icon: LucideIcon }[] = [
  { kind: 'swap',   label: 'Swap an ingredient',   description: 'Replace one ingredient with another', icon: ArrowLeftRight },
  { kind: 'add',    label: 'Add an ingredient',    description: 'Bring in a new ingredient',           icon: Plus },
  { kind: 'remove', label: 'Remove an ingredient', description: 'Take an ingredient off',              icon: Minus },
];

/**
 * Step 2 of the Update-recipe wizard. The chosen recipe sits in the
 * subtitle so the operator never loses context. Three big action
 * buttons reflect the three mutations the prototype supports today.
 */
export default function RecipeActionPickerCard({ recipeName, state, onPick, onCancel }: RecipeActionPickerCardProps) {
  return (
    <CardShell
      icon={ChefHat}
      title="What do you want to change?"
      subtitle={recipeName}
      state={state}
      onCancel={onCancel}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ACTIONS.map(({ kind, label, description, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            disabled={state !== 'pending'}
            onClick={() => onPick(kind)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: '#fff',
              cursor: state === 'pending' ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              fontFamily: 'var(--font-primary)',
              transition: 'border-color 120ms ease, background 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (state !== 'pending') return;
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--color-accent-active, #001C35)';
              el.style.background = 'rgba(40,175,201,0.04)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = 'var(--color-border, rgba(0,28,53,0.18))';
              el.style.background = '#fff';
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
                background: 'var(--color-quinn-bg, rgba(40,175,201,0.12))',
                flexShrink: 0,
              }}
            >
              <Icon size={14} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  marginTop: '2px',
                }}
              >
                {description}
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>→</span>
          </button>
        ))}
      </div>
    </CardShell>
  );
}

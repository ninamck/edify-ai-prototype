'use client';

import type { GroupBy } from '../types';

const OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'supplier', label: 'By Supplier' },
  { value: 'day', label: 'By Day' },
  { value: 'ingredient', label: 'By Ingredient' },
];

interface Props {
  value: GroupBy;
  onChange: (v: GroupBy) => void;
}

export default function GroupToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Group orders by"
      style={{
        display: 'inline-flex',
        borderRadius: '9px',
        background: 'var(--color-bg-hover)',
        padding: '3px',
        gap: '2px',
      }}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              border: 'none',
              background: active ? 'var(--color-bg-surface)' : 'transparent',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: active ? 600 : 400,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 4px rgba(58,48,40,0.12)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

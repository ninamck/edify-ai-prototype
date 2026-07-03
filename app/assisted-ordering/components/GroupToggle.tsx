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
        flexWrap: 'wrap',
        gap: '6px',
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
              padding: '5px 11px',
              borderRadius: '100px',
              border: active ? 'none' : '1px solid var(--color-border)',
              background: active ? 'var(--color-accent-active)' : '#fff',
              color: active ? '#F4F1EC' : 'var(--color-text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

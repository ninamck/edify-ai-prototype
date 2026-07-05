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
        borderRadius: 100,
        background: 'var(--color-bg-hover)',
        padding: '3px',
        width: 'fit-content',
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
              padding: '8px 14px',
              borderRadius: 100,
              border: 'none',
              background: active ? 'var(--color-accent-active)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s',
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

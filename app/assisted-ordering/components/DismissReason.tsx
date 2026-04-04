'use client';

import { useEffect, useRef } from 'react';
import type { DismissReason } from '../types';

const OPTIONS: { value: NonNullable<DismissReason>; label: string }[] = [
  { value: 'already_ordered', label: 'Already ordered' },
  { value: 'not_needed', label: 'Not needed this week' },
  { value: 'wrong_product', label: 'Wrong product' },
];

interface Props {
  onSelect: (reason: DismissReason) => void;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function DismissReasonPrompt({ onSelect, onDismiss, autoDismissMs = 3000 }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        background: 'var(--color-bg-hover)',
        borderRadius: '0 0 var(--radius-item) var(--radius-item)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-primary)',
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        Why removing?
      </span>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onSelect(opt.value);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-badge)',
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: '11px',
            fontWeight: 500,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.1s ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

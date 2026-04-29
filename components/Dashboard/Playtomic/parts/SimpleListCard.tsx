'use client';

import type { ReactNode } from 'react';

export interface SimpleListItem {
  label: string;
  /** Right-aligned trailing text (counts, money, etc.) — already formatted. */
  trailing?: string;
}

export default function SimpleListCard({
  title,
  items,
  footer,
}: {
  title: string;
  items: SimpleListItem[];
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '14px 16px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            <span>{item.label}</span>
            {item.trailing && (
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                }}
              >
                {item.trailing}
              </span>
            )}
          </li>
        ))}
      </ul>
      {footer && <div style={{ marginTop: 'auto', paddingTop: 10 }}>{footer}</div>}
    </div>
  );
}

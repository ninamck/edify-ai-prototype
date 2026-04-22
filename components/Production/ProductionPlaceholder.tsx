'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

type DataCount = {
  label: string;
  count: number;
  href?: string;
};

interface ProductionPlaceholderProps {
  slice: 'Slice 1' | 'Slice 2' | 'Slice 3' | 'Slice 4';
  title: string;
  description: string;
  dataCounts: DataCount[];
  comingUp?: string[];
  children?: ReactNode;
}

export default function ProductionPlaceholder({
  slice,
  title,
  description,
  dataCounts,
  comingUp,
  children,
}: ProductionPlaceholderProps) {
  const router = useRouter();

  return (
    <div
      style={{
        padding: '28px 24px',
        maxWidth: '860px',
        margin: '0 auto',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '100px',
          background: 'rgba(34,68,68,0.08)',
          color: 'var(--color-accent-active)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        <Sparkles size={11} strokeWidth={2.4} />
        Scaffold · arriving in {slice === 'Slice 1' ? 'this build' : slice}
      </div>

      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: '0 0 8px',
        }}
      >
        {title}
      </h1>

      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.55,
          color: 'var(--color-text-secondary)',
          margin: '0 0 24px',
          maxWidth: '640px',
        }}
      >
        {description}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          marginBottom: '24px',
        }}
      >
        {dataCounts.map(dc => (
          <button
            key={dc.label}
            type="button"
            onClick={() => dc.href && router.push(dc.href)}
            style={{
              all: 'unset',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-card)',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              cursor: dc.href ? 'pointer' : 'default',
              transition: 'border-color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (dc.href) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent-active)';
            }}
            onMouseLeave={(e) => {
              if (dc.href) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-subtle)';
            }}
          >
            <span
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {dc.count}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                fontWeight: 500,
              }}
            >
              {dc.label}
            </span>
          </button>
        ))}
      </div>

      {children}

      {comingUp && comingUp.length > 0 && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-bg-hover)',
            border: '1px dashed var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: '8px',
            }}
          >
            Coming to this screen
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {comingUp.map((c, i) => (
              <li
                key={i}
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '18px' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Back to home <ArrowRight size={12} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

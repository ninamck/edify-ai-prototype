'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export default function LogWasteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#fff',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/')}
          aria-label="Close"
          style={{
            all: 'unset',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.2,
              fontFamily: 'var(--font-display, var(--font-primary))',
            }}
          >
            Log waste
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              lineHeight: 1.2,
              marginTop: '2px',
            }}
          >
            Fitzroy Espresso
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '540px',
          margin: '0 auto',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>
    </div>
  );
}

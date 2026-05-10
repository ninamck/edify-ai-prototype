'use client';

import EdifyMark from '@/components/EdifyMark/EdifyMark';

type Props = {
  title: string;
  /** One-liner explaining what this tab will hold once it's built out. */
  description: string;
};

/**
 * Placeholder shell for Dispatch sub-tabs that aren't built yet. Sits
 * inside the dispatch sub-tab nav so the IA reads correctly even though
 * the surface itself is empty. Same compact, centred card pattern used
 * across other prototype placeholders so it doesn't feel half-finished.
 */
export default function ComingNextShell({ title, description }: Props) {
  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#ffffff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--color-info-light)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EdifyMark size={22} color="var(--color-info)" />
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-primary)',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-primary)',
            maxWidth: 380,
          }}
        >
          {description}
        </p>

        <span
          style={{
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-muted)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-primary)',
          }}
        >
          Not built yet
        </span>
      </div>
    </div>
  );
}

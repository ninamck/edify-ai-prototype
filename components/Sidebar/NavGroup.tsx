import { ReactNode } from 'react';

interface NavGroupProps {
  title: string;
  children: ReactNode;
  showDivider?: boolean;
  compact?: boolean;
}

export default function NavGroup({
  title,
  children,
  showDivider = true,
  compact = false,
}: NavGroupProps) {
  return (
    <div>
      {showDivider && (
        <div
          style={{
            height: '1px',
            background: 'var(--color-border-subtle)',
            opacity: 0.35,
            margin: compact ? '4px 2px' : '6px 0',
          }}
        />
      )}
      <div style={{ padding: compact ? '2px 0' : '6px 0 2px' }}>
        {!compact && (
          <p
            title={title}
            style={{
              padding: '0 10px 4px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {title}
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {children}
        </ul>
      </div>
    </div>
  );
}

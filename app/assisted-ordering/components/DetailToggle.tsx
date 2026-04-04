'use client';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export default function DetailToggle({ value, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}
      >
        {value ? 'Detail view' : 'Compact view'}
      </span>
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: '34px',
          height: '20px',
          borderRadius: '999px',
          background: value ? 'var(--color-accent-active)' : 'var(--color-border-subtle)',
          transition: 'background 0.2s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: value ? '17px' : '3px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(58,48,40,0.18)',
            transition: 'left 0.2s ease',
          }}
        />
      </span>
    </button>
  );
}

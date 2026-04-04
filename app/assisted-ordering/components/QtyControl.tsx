'use client';

interface QtyControlProps {
  value: number;
  onChange: (qty: number) => void;
  min?: number;
  label?: string;
}

export default function QtyControl({ value, onChange, min = 0, label = 'item' }: QtyControlProps) {
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: '36px',
          height: '36px',
          border: 'none',
          background: 'var(--color-bg-hover)',
          fontSize: '18px',
          fontWeight: 600,
          color: value <= min ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          cursor: value <= min ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-primary)',
          opacity: value <= min ? 0.4 : 1,
        }}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
        style={{
          width: '48px',
          height: '36px',
          border: 'none',
          borderLeft: '1px solid var(--color-border)',
          borderRight: '1px solid var(--color-border)',
          textAlign: 'center',
          fontSize: '15px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          background: '#fff',
          outline: 'none',
        }}
      />

      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        style={{
          width: '36px',
          height: '36px',
          border: 'none',
          background: 'var(--color-bg-hover)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-primary)',
        }}
      >
        +
      </button>
    </div>
  );
}

'use client';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
}

export default function Stepper({ value, onChange, label }: StepperProps) {
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
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
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
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= 0) onChange(n);
        }}
        aria-label={`${label} quantity`}
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
        aria-label={`Increase ${label}`}
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

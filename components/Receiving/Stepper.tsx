'use client';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  /** Render the same control read-only (e.g. a substituted line pinned
   *  to 0) so the number stays aligned with the editable rows. */
  disabled?: boolean;
}

export default function Stepper({ value, onChange, label, disabled = false }: StepperProps) {
  const btnStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    border: 'none',
    background: 'var(--color-bg-hover)',
    fontSize: '18px',
    fontWeight: 600,
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-primary)',
  };
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
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        style={btnStyle}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
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
          color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          background: '#fff',
          outline: 'none',
        }}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        style={btnStyle}
      >
        +
      </button>
    </div>
  );
}
